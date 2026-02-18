import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";
import { calculateStatistics, getLast30DaysStats, getLast12MonthsStats } from "./statistics";
import { groupLicensePlates, getUniquePlateStats } from "./grouping";

/**
 * Genera contenido HTML para PDF de estadísticas
 */
export function generateStatisticsHTML(entries: LicensePlateEntry[]): string {
  const stats = calculateStatistics(entries);
  const last30Days = getLast30DaysStats(entries);
  const last12Months = getLast12MonthsStats(entries);
  const uniqueStats = getUniquePlateStats(entries);
  const grouped = groupLicensePlates(entries);

  const now = new Date();
  const reportDate = now.toLocaleString("es-ES");

  // Generar tabla de últimos 7 días
  const last7DaysRows = last30Days
    .slice(-7)
    .reverse()
    .map(
      (day) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${day.date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${day.count}</td>
        </tr>`
    )
    .join("");

  // Generar tabla de últimos 6 meses
  const last6MonthsRows = last12Months
    .slice(-6)
    .reverse()
    .map(
      (month) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${month.month}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${month.count}</td>
        </tr>`
    )
    .join("");

  // Generar tabla de matrículas únicas (top 20)
  const topPlatesRows = grouped
    .slice(0, 20)
    .map(
      (plate, index) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${plate.licensePlate}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${plate.count}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(plate.firstSeen).toLocaleDateString("es-ES")}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(plate.lastSeen).toLocaleDateString("es-ES")}</td>
        </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte de Estadísticas - Detector de Matrículas</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #11181c;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #0066cc;
          padding-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          color: #0066cc;
          font-size: 28px;
        }
        .header p {
          margin: 5px 0;
          color: #687076;
          font-size: 12px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          color: #0066cc;
          font-size: 18px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-card {
          background-color: #f5f5f5;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }
        .stat-card .label {
          color: #687076;
          font-size: 12px;
          margin-bottom: 5px;
        }
        .stat-card .value {
          color: #0066cc;
          font-size: 24px;
          font-weight: bold;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        table th {
          background-color: #0066cc;
          color: white;
          padding: 10px;
          text-align: left;
          font-weight: bold;
        }
        table td {
          padding: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #687076;
          font-size: 12px;
        }
        .page-break {
          page-break-after: always;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Reporte de Estadísticas</h1>
        <p>Detector de Matrículas Españolas</p>
        <p>Generado: ${reportDate}</p>
      </div>

      <div class="section">
        <h2>📈 Resumen General</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Total Detecciones</div>
            <div class="value">${stats.total}</div>
          </div>
          <div class="stat-card">
            <div class="label">Matrículas Únicas</div>
            <div class="value">${uniqueStats.totalUnique}</div>
          </div>
          <div class="stat-card">
            <div class="label">Promedio por Matrícula</div>
            <div class="value">${uniqueStats.averageDetectionsPerPlate}</div>
          </div>
          <div class="stat-card">
            <div class="label">Hoy</div>
            <div class="value">${stats.today}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>📅 Últimos 7 Días</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Detecciones</th>
            </tr>
          </thead>
          <tbody>
            ${last7DaysRows}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>📆 Últimos 6 Meses</h2>
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Detecciones</th>
            </tr>
          </thead>
          <tbody>
            ${last6MonthsRows}
          </tbody>
        </table>
      </div>

      <div class="page-break"></div>

      <div class="section">
        <h2>🚗 Top 20 Matrículas Detectadas</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Matrícula</th>
              <th>Detecciones</th>
              <th>Primera Vez</th>
              <th>Última Vez</th>
            </tr>
          </thead>
          <tbody>
            ${topPlatesRows}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Este reporte fue generado automáticamente por la aplicación Detector de Matrículas.</p>
        <p>© 2026 - Todos los derechos reservados</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Genera un nombre de archivo para el PDF con timestamp
 */
export function generatePDFFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `estadisticas_matriculas_${year}${month}${day}_${hours}${minutes}.pdf`;
}
