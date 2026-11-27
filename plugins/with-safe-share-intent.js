const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const oldSignature = `        @SuppressLint("Range")
        private fun getFileInfo(uri: Uri): Map<String, String?> {`;

const newSignature = `        @SuppressLint("Range")
        // LPD_SAFE_SHARE_INTENT_PATCH
        private fun getFileInfo(uri: Uri, fallbackMimeType: String? = null): Map<String, String?> {`;

const oldResolverNull = `            if (resolver == null) {
                notifyError("Cannot get resolver (getFileInfo)")
                return mapOf(
                    "contentUri" to uri.toString(),
                    "filePath" to instance?.getAbsolutePath(uri),
                )
            }`;

const newResolverNull = `            if (resolver == null) {
                notifyError("Cannot get resolver (getFileInfo)")
                return mapOf(
                    "contentUri" to uri.toString(),
                    "filePath" to instance?.getAbsolutePath(uri),
                    "mimeType" to (fallbackMimeType ?: "application/octet-stream"),
                )
            }`;

const oldQuery = `            val queryResult: Cursor = resolver.query(uri, null, null, null, null)!!
            queryResult.moveToFirst()
            val fileName = queryResult.getString(queryResult.getColumnIndex(OpenableColumns.DISPLAY_NAME))
            val fileSize = queryResult.getString(queryResult.getColumnIndex(OpenableColumns.SIZE))
            queryResult.close()

            val mimeType = resolver.getType(uri)!!`;

const newQuery = `            var fileName: String? = null
            var fileSize: String? = null
            var queryResult: Cursor? = null

            try {
                queryResult = resolver.query(uri, null, null, null, null)

                if (queryResult != null && queryResult.moveToFirst()) {
                    val nameColumn = queryResult.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeColumn = queryResult.getColumnIndex(OpenableColumns.SIZE)

                    if (nameColumn >= 0) {
                        fileName = queryResult.getString(nameColumn)
                    }

                    if (sizeColumn >= 0) {
                        fileSize = queryResult.getString(sizeColumn)
                    }
                } else {
                    notifyError("Cannot query file metadata for $uri")
                }
            } catch (error: Exception) {
                notifyError("Cannot read file metadata for $uri: \${error.message}")
            } finally {
                try {
                    queryResult?.close()
                } catch (error: Exception) {
                    Log.w(
                        "ExpoShareIntentModule",
                        "Cannot close file metadata cursor for $uri",
                        error
                    )
                }
            }

            val mimeType: String = try {
                resolver.getType(uri)
                    ?: fallbackMimeType
                    ?: "application/octet-stream"
            } catch (error: Exception) {
                notifyError("Cannot resolve MIME type for $uri: \${error.message}")
                fallbackMimeType ?: "application/octet-stream"
            }`;

const oldSend = `                        notifyShareIntent(mapOf( "files" to arrayOf(getFileInfo(uri), "type" to "file")))`;

const newSend = `                        notifyShareIntent(mapOf(
                            "files" to listOf(getFileInfo(uri, intent.type)),
                            "type" to "file"
                        ))`;

const oldMultiple = `                        notifyShareIntent(mapOf( "files" to uris.map { getFileInfo(it) }, "type" to "file"))`;

const newMultiple = `                        notifyShareIntent(mapOf(
                            "files" to uris.map { getFileInfo(it, intent.type) },
                            "type" to "file"
                        ))`;

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(
      "No se reconoce exactamente una vez el bloque " +
      label + ". Coincidencias: " + count
    );
  }
  return source.replace(oldText, newText);
}

function kotlinBracePairs(source) {
  const stack = [];
  const pairs = new Map();
  let state = "normal";
  let blockDepth = 0;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1], n2 = source[i + 2];
    if (state === "line") { if (c === "\n") state = "normal"; continue; }
    if (state === "block") {
      if (c === "/" && n === "*") { blockDepth += 1; i += 1; }
      else if (c === "*" && n === "/") { blockDepth -= 1; i += 1; if (blockDepth === 0) state = "normal"; }
      continue;
    }
    if (state === "string" || state === "char") {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if ((state === "string" && c === '"' ) || (state === "char" && c === "'")) state = "normal";
      continue;
    }
    if (state === "triple") { if (c === '"' && n === '"' && n2 === '"') { state = "normal"; i += 2; } continue; }
    if (c === "/" && n === "/") { state = "line"; i += 1; continue; }
    if (c === "/" && n === "*") { state = "block"; blockDepth = 1; i += 1; continue; }
    if (c === '"' && n === '"' && n2 === '"') { state = "triple"; i += 2; continue; }
    if (c === '"') { state = "string"; escaped = false; continue; }
    if (c === "'") { state = "char"; escaped = false; continue; }
    if (c === "{") stack.push(i);
    else if (c === "}") { if (!stack.length) throw new Error("Kotlin: llave de cierre sin apertura."); const open = stack.pop(); pairs.set(open, i); }
  }
  if (state === "block" || state === "string" || state === "triple" || state === "char" || stack.length) throw new Error("Kotlin: estructura de llaves o literales incompleta.");
  return pairs;
}

function findMatchingKotlinBrace(source, openIndex) {
  const close = kotlinBracePairs(source).get(openIndex);
  if (close === undefined) throw new Error("Kotlin: no se encuentra la llave de cierre.");
  return close;
}

function replaceKotlinIfBlock(source, condition, replacement, label) {
  const first = source.indexOf(condition);
  if (first < 0 || source.indexOf(condition, first + condition.length) >= 0) throw new Error("No se reconoce una única condición Kotlin: " + label);
  const openIndex = first + condition.lastIndexOf("{");
  const closeIndex = findMatchingKotlinBrace(source, openIndex);
  const lineStart = source.lastIndexOf("\n", first) + 1;
  const indent = source.slice(lineStart, first);
  if (!/^[ \t]*$/.test(indent)) throw new Error("Indentación Kotlin inesperada: " + label);
  return source.slice(0, lineStart) + replacement(indent) + source.slice(closeIndex + 1);
}

function assertBalancedKotlinBraces(source) {
  kotlinBracePairs(source);
  const required = [["class ExpoShareIntentModule", 1], ["ModuleDefinition {", 1], ["OnNewIntent {", 1], ["OnCreate {", 1], ["OnDestroy {", 1]];
  for (const [token, expected] of required) {
    const actual = source.split(token).length - 1;
    if (actual !== expected) throw new Error("Kotlin: " + token + " debe aparecer " + expected + " vez; aparece " + actual);
  }
  return true;
}

function applyNullableTargetFilePatch(source) {
  const marker = "LPD_NONNULL_TARGET_FILE_FOR_STREAM";
  const oldBlock = `            resolver.openInputStream(uri)?.use { input ->
                FileOutputStream(targetFile).use { fileOut ->
                    input.copyTo(fileOut)
                }
            }
            return targetFile.path`;

  const newBlock = `            // ${marker}
            val outputFile = targetFile ?: return null
            resolver.openInputStream(uri)?.use { input ->
                FileOutputStream(outputFile).use { fileOut ->
                    input.copyTo(fileOut)
                }
            }
            return outputFile.path`;

  if (source.includes(marker)) {
    if (
      !source.includes("val outputFile = targetFile ?: return null") ||
      !source.includes("FileOutputStream(outputFile)") ||
      !source.includes("return outputFile.path")
    ) {
      throw new Error("La corrección nullable existente está incompleta.");
    }
    return source;
  }

  const matches = source.split(oldBlock).length - 1;
  if (matches !== 1) {
    throw new Error(
      "Se esperaba exactamente un bloque getDataColumn original; encontrados: " + matches
    );
  }

  return source.replace(oldBlock, newBlock);
}

function applyPatch(source) {
  let result = source;
  result = applyNullableTargetFilePatch(result);

  const baseMarker = "LPD_SAFE_SHARE_INTENT_PATCH";
  const hotMarker = "LPD_NO_RELAUNCH_ON_NEW_INTENT";

  function buildDirectTaskDispatch(indent) {
    return [
      indent + "if (!fromNewIntent && activity != null && !activity.isTaskRoot) {",
      indent + "    // LPD_HOT_TASK_FORWARD_TO_EXISTING_TASK",
      indent + "    val existingTask = try {",
      indent + "        val manager = activity.getSystemService(android.content.Context.ACTIVITY_SERVICE) as? android.app.ActivityManager",
      indent + "        manager?.appTasks?.firstOrNull { task ->",
      indent + "            task.taskInfo.id != activity.taskId &&",
      indent + "                task.taskInfo.baseActivity?.className == activity.javaClass.name",
      indent + "        }",
      indent + "    } catch (error: Exception) {",
      indent + '        Log.w("LPDShareIntent", "No se pudieron consultar las tareas de LPD", error)',
      indent + "        null",
      indent + "    }",
      indent + "    if (existingTask != null) {",
      indent + "        val forwardedIntent = Intent(intent).apply {",
      indent + "            component = android.content.ComponentName(activity.packageName, activity.javaClass.name)",
      indent + "            flags = (flags and (Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NEW_DOCUMENT or Intent.FLAG_ACTIVITY_MULTIPLE_TASK).inv()) or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP",
      indent + "        }",
      indent + "        try {",
      indent + '            Log.i("LPDShareIntent", "Reenviando Intent a la tarea original: origen=" + activity.taskId + " destino=" + existingTask.taskInfo.id)',
      indent + "            existingTask.startActivity(activity, forwardedIntent, null)",
      indent + '            Log.i("LPDShareIntent", "Intent entregado a la tarea original")',
      indent + "            activity.finish()",
      indent + "            return",
      indent + "        } catch (error: Exception) {",
      indent + '            Log.e("LPDShareIntent", "No se pudo reenviar el Intent a la tarea original", error)',
      indent + "        }",
      indent + "    }",
      indent + '    Log.w("LPDShareIntent", "No se encontró tarea original; se conserva el relanzamiento de respaldo")',
      indent + "    val newIntent = Intent(intent).apply {",
      indent + "        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)",
      indent + "    }",
      indent + "    activity.startActivity(newIntent)",
      indent + "    activity.finish()",
      indent + "    return",
      indent + "}"
    ].join("\n");
  }

  const baseValid =
    result.includes("fallbackMimeType: String? = null") &&
    result.includes("getFileInfo(uri, intent.type)") &&
    result.includes("getFileInfo(it, intent.type)") &&
    !result.includes("resolver.query(uri, null, null, null, null)!!") &&
    !result.includes("resolver.getType(uri)!!");

  if (result.includes(baseMarker)) {
    if (!baseValid) {
      throw new Error("El parche base Kotlin está incompleto.");
    }
  } else {
    result = replaceOnce(result, oldSignature, newSignature, "firma getFileInfo");
    result = replaceOnce(result, oldResolverNull, newResolverNull, "resolver nulo");
    result = replaceOnce(result, oldQuery, newQuery, "consulta de metadatos");
    result = replaceOnce(result, oldSend, newSend, "ACTION_SEND");
    result = replaceOnce(result, oldMultiple, newMultiple, "ACTION_SEND_MULTIPLE");
  }

  if (!result.includes(baseMarker) ||
      !result.includes("fallbackMimeType: String? = null") ||
      !result.includes("getFileInfo(uri, intent.type)") ||
      !result.includes("getFileInfo(it, intent.type)") ||
      result.includes("resolver.query(uri, null, null, null, null)!!") ||
      result.includes("resolver.getType(uri)!!")) {
    throw new Error("La validación del parche base ha fallado.");
  }

  if (result.includes(hotMarker)) {
    const hotValid =
      result.includes("handleShareIntent(intent: Intent, fromNewIntent: Boolean = false)") &&
      result.includes("handleShareIntent(it, fromNewIntent = true)") &&
      result.includes("OnNewIntent recibido") &&
      result.includes("handleShareIntent(ExpoShareIntentSingleton.intent!!);");
    if (!hotValid) throw new Error("El parche de app caliente existente está incompleto.");
    const forwardMarker = "LPD_HOT_TASK_FORWARD_TO_EXISTING_TASK";
    const forwardIsValid = () =>
      result.includes("existingTask.startActivity(activity, forwardedIntent, null)") &&
      result.includes("Intent.FLAG_ACTIVITY_CLEAR_TOP") &&
      result.includes("Intent.FLAG_ACTIVITY_SINGLE_TOP") &&
      result.includes("android.content.ComponentName(activity.packageName, activity.javaClass.name)");
    if (result.includes(forwardMarker)) {
      if (!forwardIsValid()) throw new Error("El reenvío nativo a la tarea original está incompleto.");
      return result;
    }
    result = replaceKotlinIfBlock(
      result,
      "if (!fromNewIntent && activity != null && !activity.isTaskRoot) {",
      indent => buildDirectTaskDispatch(indent),
      "reenvío en caliente"
    );
    if (!result.includes(forwardMarker) || !forwardIsValid()) throw new Error("Falló la validación del reenvío a la tarea original.");
    return result;
  }
  const signaturePattern =
    /^([ \t]*)(private[ \t]+)?fun handleShareIntent\(intent: Intent\)[ \t]*\{/gm;

  const signatureMatches = Array.from(result.matchAll(signaturePattern));

  if (signatureMatches.length !== 1) {
    throw new Error(
      "No se reconoce una única función handleShareIntent. Coincidencias: " +
      signatureMatches.length
    );
  }

  result = result.replace(signaturePattern, function(match, indent, modifier) {
    return indent +
      "// LPD_NO_RELAUNCH_ON_NEW_INTENT\n" +
      indent +
      (modifier || "") +
      "fun handleShareIntent(intent: Intent, fromNewIntent: Boolean = false) {";
  });

  const activityLine = "val activity = instance?.currentActivity";
  if (countText(result, activityLine) !== 1) {
    throw new Error("No se reconoce una única obtención de currentActivity.");
  }
  const coldCondition = "if (activity != null && !activity.isTaskRoot) {";
  result = replaceKotlinIfBlock(
    result,
    coldCondition,
    indent =>
      indent + 'Log.i("LPDShareIntent", "handleShareIntent fromNewIntent=" + fromNewIntent + " isTaskRoot=" + (activity?.isTaskRoot ?: "no-activity"))\n' +
      buildDirectTaskDispatch(indent),
    "desvío de arranque"
  );
  const newIntentPattern =
    /^([ \t]*)OnNewIntent \{\n\1([ \t]+)handleShareIntent\(it\)\n\1\}/gm;

  const newIntentMatches = Array.from(result.matchAll(newIntentPattern));

  if (newIntentMatches.length !== 1) {
    throw new Error(
      "No se reconoce un único bloque OnNewIntent. Coincidencias: " +
      newIntentMatches.length
    );
  }

  result = result.replace(newIntentPattern, function(match, indent, inner) {
    return indent +
      "OnNewIntent {\n" +
      inner +
      'Log.i("LPDShareIntent", "OnNewIntent recibido")\n' +
      inner +
      "handleShareIntent(it, fromNewIntent = true)\n" +
      indent +
      "}";
  });

  const hotValid =
    result.includes(hotMarker) &&
    result.includes("handleShareIntent(intent: Intent, fromNewIntent: Boolean = false)") &&
    result.includes("!fromNewIntent && activity != null && !activity.isTaskRoot") &&
    result.includes("handleShareIntent(it, fromNewIntent = true)") &&
    result.includes("OnNewIntent recibido") &&
    result.includes("handleShareIntent(ExpoShareIntentSingleton.intent!!);") &&
    result.includes("activity.startActivity(newIntent)") &&
    result.includes("activity.finish()") &&
    result.includes("LPD_HOT_TASK_FORWARD_TO_EXISTING_TASK") &&
    result.includes("existingTask.startActivity(activity, forwardedIntent, null)") &&
    !result.includes("handleShareIntent(intent, fromNewIntent = true)");

  if (!hotValid) {
    throw new Error("La validación final del parche de app caliente ha fallado.");
  }

  return result;
}

function applyListenerPatch(source) {
  const marker = "LPD_SHARE_INTENT_LISTENER_FIRST";

  if (source.includes(marker)) {
    const markerIndex = source.indexOf(marker);
    const onChangeIndex = source.indexOf('addListener("onChange"');
    const onErrorIndex = source.indexOf('addListener("onError"');
    const readyIndex = source.indexOf("setIsReady(true);", markerIndex);
    const refreshIndex = source.indexOf("refreshShareIntent();", markerIndex);

    if (
      onChangeIndex < 0 ||
      onErrorIndex < 0 ||
      markerIndex < onChangeIndex ||
      markerIndex < onErrorIndex ||
      readyIndex >= 0 ||
      refreshIndex < 0 ||
      refreshIndex - markerIndex > 160
    ) {
      throw new Error("El parche JavaScript existente está incompleto o alterado.");
    }

    const mountEffect = source.match(
      /useEffect\(\(\) => \{\s*if \(options\.disabled\)\s*return;[\s\S]*?\}, \[url, options\.disabled\]\);/
    );

    if (!mountEffect || mountEffect[0].includes("refreshShareIntent();")) {
      throw new Error("El efecto inicial del hook no tiene el estado esperado.");
    }

    return source;
  }

  const mountPattern =
    /useEffect\(\(\) => \{\s*if \(options\.disabled\)\s*return;\s*options\.debug &&\s*console\.debug\("useShareIntent\[mount\]", getScheme\(options\), options\);\s*refreshShareIntent\(\);\s*\}, \[url, options\.disabled\]\);/;

  const matches = source.match(mountPattern);
  if (!matches || matches.length !== 1) {
    throw new Error(
      "No se reconoce exactamente el efecto inicial de useShareIntent."
    );
  }

  let updated = source.replace(
    mountPattern,
    (block) => block.replace(/\s*refreshShareIntent\(\);/, "")
  );

  const readyMatches = updated.match(/setIsReady\(true\);/g) || [];
  if (readyMatches.length !== 1) {
    throw new Error(
      "No se reconoce exactamente una llamada setIsReady(true)."
    );
  }

  const onChangeIndex = updated.indexOf('addListener("onChange"');
  const onErrorIndex = updated.indexOf('addListener("onError"');
  const readyIndex = updated.indexOf("setIsReady(true);");

  if (
    onChangeIndex < 0 ||
    onErrorIndex < 0 ||
    readyIndex < onChangeIndex ||
    readyIndex < onErrorIndex
  ) {
    throw new Error(
      "Los listeners no están instalados antes de setIsReady(true)."
    );
  }

  updated = updated.replace(
    "setIsReady(true);",
    "setIsReady(true);\n        // LPD_SHARE_INTENT_LISTENER_FIRST\n        refreshShareIntent();"
  );

  const markerIndex = updated.indexOf(marker);
  const refreshIndex = updated.indexOf("refreshShareIntent();", markerIndex);

  if (
    markerIndex < 0 ||
    refreshIndex < markerIndex ||
    refreshIndex - markerIndex > 160
  ) {
    throw new Error("No se pudo validar el orden listener-first.");
  }

  const finalMount = updated.match(
    /useEffect\(\(\) => \{\s*if \(options\.disabled\)\s*return;[\s\S]*?\}, \[url, options\.disabled\]\);/
  );

  if (!finalMount || finalMount[0].includes("refreshShareIntent();")) {
    throw new Error("El efecto de montaje todavía recupera la intención prematuramente.");
  }

  return updated;
}

module.exports = function withSafeShareIntent(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const target = path.join(
        projectRoot,
        "node_modules",
        "expo-share-intent",
        "android",
        "src",
        "main",
        "java",
        "expo",
        "modules",
        "shareintent",
        "ExpoShareIntentModule.kt"
      );

      if (!fs.existsSync(target)) {
        throw new Error("No se encuentra ExpoShareIntentModule.kt: " + target);
      }

      const hookTarget = path.join(
        projectRoot,
        "node_modules",
        "expo-share-intent",
        "build",
        "useShareIntent.js"
      );

      if (!fs.existsSync(hookTarget)) {
        throw new Error("No se encuentra useShareIntent.js compilado: " + hookTarget);
      }

      // Leer y validar ambos archivos antes de escribir ninguno.
      const kotlinOriginal = fs.readFileSync(target, "utf8");
      const hookOriginal = fs.readFileSync(hookTarget, "utf8");

      const kotlinUpdated = applyPatch(kotlinOriginal);
      assertBalancedKotlinBraces(kotlinUpdated);
      const hookUpdated = applyListenerPatch(hookOriginal);

      // Preparar todos los temporales antes de sustituir archivos.
      const writes = [
        { target, original: kotlinOriginal, updated: kotlinUpdated },
        { target: hookTarget, original: hookOriginal, updated: hookUpdated },
      ].filter((item) => item.updated !== item.original);

      const staged = [];
      const committed = [];
      const transactionId = `${process.pid}-${Date.now()}`;

      try {
        // Primera fase: preparar todos los temporales.
        for (let index = 0; index < writes.length; index += 1) {
          const item = writes[index];
          const temporary =
            `${item.target}.lpd-tmp-${transactionId}-${index}`;

          const stagedItem = { ...item, temporary };
          staged.push(stagedItem);

          fs.writeFileSync(temporary, item.updated, {
            encoding: "utf8",
            flag: "wx",
          });
        }

        // Segunda fase: sustituir mediante rename atómico.
        for (const item of staged) {
          fs.renameSync(item.temporary, item.target);
          item.temporary = null;
          committed.push(item);
        }
      } catch (error) {
        // Restaurar los archivos sustituidos, en orden inverso.
        for (const item of [...committed].reverse()) {
          const restoreTemporary =
            `${item.target}.lpd-restore-${transactionId}`;

          try {
            fs.writeFileSync(restoreTemporary, item.original, {
              encoding: "utf8",
              flag: "wx",
            });

            fs.renameSync(restoreTemporary, item.target);
          } catch (restoreError) {
            console.error(
              "[LPD] Error restaurando archivo:",
              item.target,
              restoreError
            );

            try {
              if (fs.existsSync(restoreTemporary)) {
                fs.unlinkSync(restoreTemporary);
              }
            } catch (cleanupError) {
              console.error(
                "[LPD] Error limpiando temporal de restauración:",
                restoreTemporary,
                cleanupError
              );
            }
          }
        }

        // Limpiar todos los temporales de preparación restantes.
        for (const item of staged) {
          if (item.temporary && fs.existsSync(item.temporary)) {
            try {
              fs.unlinkSync(item.temporary);
            } catch (cleanupError) {
              console.error(
                "[LPD] Error limpiando temporal:",
                item.temporary,
                cleanupError
              );
            }
          }
        }

        throw error;
      }

      console.log(
        kotlinUpdated === kotlinOriginal
          ? "[LPD] Parche Kotlin ya estaba aplicado"
          : "[LPD] Parche Kotlin aplicado"
      );

      console.log(
        hookUpdated === hookOriginal
          ? "[LPD] Parche listener-first JavaScript ya estaba aplicado"
          : "[LPD] Parche listener-first JavaScript aplicado"
      );

      return config;
    },
  ]);
};
