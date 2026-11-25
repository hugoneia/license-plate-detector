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

function applyPatch(source) {
  let result = source;

  const baseMarker = "LPD_SAFE_SHARE_INTENT_PATCH";
  const hotMarker = "LPD_NO_RELAUNCH_ON_NEW_INTENT";

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
      result.includes("!fromNewIntent && activity != null && !activity.isTaskRoot") &&
      result.includes("handleShareIntent(it, fromNewIntent = true)") &&
      result.includes("OnNewIntent recibido") &&
      result.includes("handleShareIntent(ExpoShareIntentSingleton.intent!!);") &&
      result.includes("activity.startActivity(newIntent)") &&
      result.includes("activity.finish()");

    if (!hotValid) {
      throw new Error("El parche de app caliente existente está incompleto.");
    }

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

  const guardPattern =
    /^([ \t]*)val activity = instance\?\.currentActivity\n\1if \(activity != null && !activity\.isTaskRoot\) \{/gm;

  const guardMatches = Array.from(result.matchAll(guardPattern));

  if (guardMatches.length !== 1) {
    throw new Error(
      "No se reconoce una única condición de relanzamiento. Coincidencias: " +
      guardMatches.length
    );
  }

  result = result.replace(guardPattern, function(match, indent) {
    return indent +
      "val activity = instance?.currentActivity\n" +
      indent +
      'Log.i("LPDShareIntent", "handleShareIntent fromNewIntent=" + fromNewIntent + " isTaskRoot=" + (activity?.isTaskRoot ?: "no-activity"))\n' +
      indent +
      "if (!fromNewIntent && activity != null && !activity.isTaskRoot) {";
  });

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
    result.includes("activity.finish()");

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
