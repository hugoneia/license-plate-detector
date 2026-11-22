import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Papa from "papaparse";

import { isValidSpanishPlate } from "@/lib/license-plate";
import {
  addParkingOkEntries,
  loadParkingOkEntries,
  saveParkingOkEntries,
  type ParkingOkEntry,
} from "@/lib/parking-ok-storage";
import {
  loadHomeLocations,
  saveHomeLocations,
} from "@/lib/home-location-storage";
import { planParkingOkImport, type ParkingOkImportCandidate } from "@/lib/parking-ok-import";

let parkingOkImportInProgress = false;

export async function importParkingOkCSV(
  sharedFile: { uri: string; name: string } | undefined,
  addAlert: (message: string, type: "error" | "warning" | "success") => void,
  isImporting: () => boolean,
  onImportingChange: (value: boolean) => void,
) {
    if (parkingOkImportInProgress || isImporting()) {
      return;
    }

    parkingOkImportInProgress = true;
    onImportingChange(true);

    try {
      let fileUri: string;
      let fileName: string;

      if (sharedFile) {
        fileUri = sharedFile.uri;
        fileName = sharedFile.name || "archivo.csv";
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: "*/*",
        });

        if (
          result.canceled ||
          !result.assets ||
          result.assets.length === 0
        ) {
          return;
        }

        const file = result.assets[0];
        fileUri = file.uri;
        fileName = file.name || "";
      }

      if (!fileName.toLowerCase().endsWith(".csv")) {
        addAlert(
          `El archivo debe tener extensión .csv. Archivo seleccionado: ${fileName}`,
          "error"
        );
        return;
      }

      const csvText = await FileSystem.readAsStringAsync(fileUri);

      const parsed = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toUpperCase(),
      });

      if (parsed.errors.length > 0) {
        console.error("Errores al parsear Parking OK CSV:", parsed.errors);
        addAlert("Error al leer el archivo CSV de Parking OK", "error");
        return;
      }

      const data = parsed.data;

      if (data.length === 0) {
        addAlert("El archivo CSV no contiene datos", "error");
        return;
      }

      const firstRow = data[0];
      const requiredHeaders = [
        "MATRÍCULA",
        "FECHA",
        "HORA",
        "LATITUD/LONGITUD",
        "LUGAR",
      ];

      for (const header of requiredHeaders) {
        if (!(header in firstRow)) {
          addAlert(`Encabezado faltante: "${header}"`, "error");
          return;
        }
      }

      // IS_HOME es opcional para conservar compatibilidad con CSV antiguos.
      const hasIsHomeColumn = Object.prototype.hasOwnProperty.call(
        firstRow,
        "IS_HOME"
      );
      const currentHomeLocations = await loadHomeLocations();
      const candidates: ParkingOkImportCandidate[] = [];

      for (let lineIndex = 0; lineIndex < data.length; lineIndex++) {
        const row = data[lineIndex];

        const licensePlate = (row["MATRÍCULA"] || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "");

        const dateStr = (row["FECHA"] || "").trim();
        const timeStr = (row["HORA"] || "").trim();
        const locationStr = (row["LATITUD/LONGITUD"] || "").trim();
        const lugarCode = (row["LUGAR"] || "").trim().toUpperCase();

        const lineNumber = lineIndex + 2;

        if (!licensePlate) {
          addAlert(`Línea ${lineNumber}: matrícula vacía`, "error");
          return;
        }

        if (!isValidSpanishPlate(licensePlate)) {
          addAlert(
            `Línea ${lineNumber}: Matrícula inválida "${licensePlate}"`,
            "error"
          );
          return;
        }

        const isHomeValue = (row["IS_HOME"] || "").trim().toUpperCase();

        if (
          hasIsHomeColumn &&
          isHomeValue !== "" &&
          isHomeValue !== "SI" &&
          isHomeValue !== "NO"
        ) {
          addAlert(
            `Línea ${lineNumber}: IS_HOME debe ser "SI" o "NO"`,
            "error"
          );
          return;
        }

        const isHome = hasIsHomeColumn && isHomeValue === "SI";

        if (lugarCode !== "OK") {
          addAlert(
            `Línea ${lineNumber}: el campo LUGAR debe ser "OK"`,
            "error"
          );
          return;
        }

        const dateParts = dateStr.split("/");

        if (dateParts.length !== 3) {
          addAlert(
            `Línea ${lineNumber}: Formato de fecha inválido "${dateStr}". Esperado: dd/mm/yyyy`,
            "error"
          );
          return;
        }

        const [day, month, year] = dateParts.map(Number);

        if (
          !Number.isInteger(day) ||
          !Number.isInteger(month) ||
          !Number.isInteger(year) ||
          year < 1 ||
          month < 1 ||
          month > 12 ||
          day < 1 ||
          day > 31
        ) {
          addAlert(
            `Línea ${lineNumber}: Fecha inválida "${dateStr}"`,
            "error"
          );
          return;
        }

        const timeParts = timeStr.split(":");

        if (timeParts.length !== 3) {
          addAlert(
            `Línea ${lineNumber}: Formato de hora inválido "${timeStr}". Esperado: hh:mm:ss`,
            "error"
          );
          return;
        }

        const [hour, minute, second] = timeParts.map(Number);

        if (
          !Number.isInteger(hour) ||
          !Number.isInteger(minute) ||
          !Number.isInteger(second) ||
          hour < 0 ||
          hour > 23 ||
          minute < 0 ||
          minute > 59 ||
          second < 0 ||
          second > 59
        ) {
          addAlert(
            `Línea ${lineNumber}: Hora inválida "${timeStr}"`,
            "error"
          );
          return;
        }

        const timestamp = new Date(
          year,
          month - 1,
          day,
          hour,
          minute,
          second
        ).getTime();

        const parsedDate = new Date(timestamp);

        if (
          parsedDate.getFullYear() !== year ||
          parsedDate.getMonth() !== month - 1 ||
          parsedDate.getDate() !== day ||
          parsedDate.getHours() !== hour ||
          parsedDate.getMinutes() !== minute ||
          parsedDate.getSeconds() !== second
        ) {
          addAlert(
            `Línea ${lineNumber}: Fecha u hora inexistente "${dateStr} ${timeStr}"`,
            "error"
          );
          return;
        }

        let location: ParkingOkEntry["location"] = "NO GPS";

        if (
          locationStr &&
          locationStr.toUpperCase() !== "NO GPS"
        ) {
          const coordParts = locationStr
            .replace(/^"(.*)"$/, "$1")
            .split(",");

          if (coordParts.length !== 2) {
            addAlert(
              `Línea ${lineNumber}: Formato de coordenadas inválido "${locationStr}". Esperado: "lat,lng" o "NO GPS"`,
              "error"
            );
            return;
          }

          const latitude = Number(coordParts[0].trim());
          const longitude = Number(coordParts[1].trim());

          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            addAlert(
              `Línea ${lineNumber}: Coordenadas GPS inválidas "${locationStr}"`,
              "error"
            );
            return;
          }

          location = {
            latitude,
            longitude,
          };
        }

        candidates.push({
          entry: {
            id: `${licensePlate}-${timestamp}`,
            licensePlate,
            timestamp,
            location,
          },
          isHome,
        });
      }

      if (candidates.length === 0) {
        addAlert("El archivo CSV no contiene registros válidos", "error");
        return;
      }

      const currentEntries = await loadParkingOkEntries();
      const plan = planParkingOkImport(
        candidates,
        currentEntries,
        currentHomeLocations
      );

      let parkingWriteCompleted = false;
      let homesWriteAttempted = false;

      try {
        if (plan.entriesToAdd.length > 0) {
          await addParkingOkEntries(plan.entriesToAdd);
          parkingWriteCompleted = true;
        }

        if (plan.homesCreated > 0) {
          homesWriteAttempted = true;
          await saveHomeLocations(plan.homeLocations);
        }
      } catch (persistError) {
        const rollbackErrors: string[] = [];

        if (homesWriteAttempted) {
          try {
            await saveHomeLocations(currentHomeLocations);
          } catch {
            rollbackErrors.push("domicilios");
          }
        }

        if (parkingWriteCompleted) {
          try {
            await saveParkingOkEntries(currentEntries);
          } catch {
            rollbackErrors.push("Parking OK");
          }
        }

        if (rollbackErrors.length > 0) {
          throw new Error(
            `Falló el guardado de la importación y no se pudo restaurar: ${rollbackErrors.join(", ")}. Revisa los datos antes de repetirla.`
          );
        }

        throw persistError;
      }

      const skippedHomeCount = plan.skippedExistingHomeCount;

      const hasOmissions =
        plan.duplicateCount > 0 || skippedHomeCount > 0;

      const importAlertType =
        plan.addedCount === 0 && hasOmissions
          ? "error"
          : plan.addedCount > 0 && hasOmissions
            ? "warning"
            : "success";

      addAlert(
        `Parking OK: ${plan.addedCount} añadidos, ${plan.homesCreated} domicilios, ${plan.duplicateCount} duplicados y ${skippedHomeCount} domicilios omitidos.`,
        importAlertType
      );
    } catch (error) {
      console.error("Error al importar Parking OK:", error);
      addAlert("Error al importar Parking OK", "error");
    } finally {
      parkingOkImportInProgress = false;
      onImportingChange(false);
    }
  }
