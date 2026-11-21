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
                queryResult?.close()
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
  if (source.includes("LPD_SAFE_SHARE_INTENT_PATCH")) {
    const valid =
      source.includes("fallbackMimeType: String? = null") &&
      source.includes("getFileInfo(uri, intent.type)") &&
      source.includes("getFileInfo(it, intent.type)") &&
      !source.includes("resolver.query(uri, null, null, null, null)!!") &&
      !source.includes("resolver.getType(uri)!!");

    if (!valid) {
      throw new Error("Marca de parche incompleta o inconsistente.");
    }
    return source;
  }

  let result = source;
  result = replaceOnce(result, oldSignature, newSignature, "firma getFileInfo");
  result = replaceOnce(result, oldResolverNull, newResolverNull, "resolver nulo");
  result = replaceOnce(result, oldQuery, newQuery, "consulta de metadatos");
  result = replaceOnce(result, oldSend, newSend, "ACTION_SEND");
  result = replaceOnce(result, oldMultiple, newMultiple, "ACTION_SEND_MULTIPLE");

  if (
    !result.includes("LPD_SAFE_SHARE_INTENT_PATCH") ||
    result.includes("resolver.query(uri, null, null, null, null)!!") ||
    result.includes("resolver.getType(uri)!!")
  ) {
    throw new Error("La validación final del parche Kotlin ha fallado.");
  }

  return result;
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

      const original = fs.readFileSync(target, "utf8");
      const updated = applyPatch(original);

      if (updated !== original) {
        fs.writeFileSync(target, updated, "utf8");
        console.log("[LPD] Parche seguro aplicado a expo-share-intent 5.1.1");
      } else {
        console.log("[LPD] Parche seguro de expo-share-intent ya estaba aplicado");
      }

      return config;
    },
  ]);
};
