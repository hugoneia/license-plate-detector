# ARCHITECTURE.md

## Propósito

Este documento define la arquitectura prevista y las restricciones de la aplicación.

**Lee este archivo antes de realizar cambios arquitectónicos, añadir dependencias o reintroducir infraestructura.**

El objetivo es mantener la aplicación sencilla, local y centrada en la detección de matrículas, registro de datos, estadísticas, intercambio mediante CSV, GPS y visualización en mapa.

---

## 1. Arquitectura principal

La aplicación sigue un enfoque **local-first (local como prioridad)**.

### Principios obligatorios

- El OCR de matrículas debe ejecutarse **localmente en el dispositivo**.
- La detección principal de matrículas **no debe depender de OCR remoto, LLM, API ni servidor**.
- Los registros de matrículas se almacenan localmente utilizando la arquitectura de almacenamiento existente.
- Las coordenadas GPS se almacenan localmente junto con los registros cuando están disponibles.
- CSV es el formato de intercambio y exportación de datos.
- La aplicación debe poder utilizarse sin cuenta de usuario ni backend remoto.

No introduzcas un servidor/backend para una funcionalidad que pueda implementarse razonablemente de forma local.

---

## 2. Autenticación y usuarios

Actualmente **no existe registro de usuarios, inicio de sesión, OAuth, cuentas ni sistema de autenticación, más allá de una protección mediante PIN para acceso a la aplicación**.

No añadir:

- infraestructura OAuth
- JWT/sesiones
- pantallas de login
- tablas de usuarios
- servidores de autenticación
- gestión de cuentas

salvo que un requisito futuro solicite explícitamente cuentas de usuario.

Si una funcionalidad futura necesita realmente cuentas, introduce únicamente la infraestructura necesaria y explica previamente por qué es necesaria.

---

## 3. Backend y servicios remotos

La aplicación actual **no necesita un backend general**.

No reintroducir:

- servidores Express
- tRPC
- endpoints remotos para detección de matrículas
- OCR remoto mediante LLM
- MySQL
- Drizzle ORM
- autenticación del lado servidor
- sesiones/cookies del lado servidor

salvo que una funcionalidad futura requiera explícitamente un backend.

No debe introducirse un backend simplemente porque el proyecto original o una plantilla antigua utilizara uno.

---

## 4. Flujo actual de la aplicación

El flujo previsto de la cámara es aproximadamente:

Cámara
→ capturar imagen
→ OCR local
→ limpiar/validar matrícula detectada
→ obtener ubicación GPS cuando esté disponible
→ crear/actualizar registro local
→ actualizar historial/estadísticas/avisos

El resultado del OCR debe permanecer local.

También se admite la introducción manual de matrículas.

---

## 5. GPS

El GPS es una parte importante de la aplicación y debe conservarse.

El objetivo a largo plazo es asociar las coordenadas GPS a las matrículas detectadas que coincidan con el registro de matrículas importado.

No eliminar la funcionalidad GPS aunque se modifique el sistema de mapas o la visualización de ubicaciones.

---

## 6. CSV

CSV es el formato de intercambio de datos de la aplicación.

Actualmente la aplicación utiliza CSV para importar y exportar datos.

Los datos CSV pueden incluir:

- matrícula
- fecha/hora
- latitud
- longitud
- clasificación de estacionamiento o ubicación, como `acera` o `doble_fila` (entre otros).

Conservar la importación/exportación CSV y el comportamiento de cifrado existente salvo que un requisito futuro indique expresamente lo contrario.

---

## 7. Mapas

Los mapas son actualmente necesarios.

La sección de estadísticas incluye un mapa que muestra las ubicaciones de las matrículas registradas y permite buscar una matrícula individual.

La arquitectura actual del mapa utiliza:

- React Native WebView
- Leaflet
- teselas raster de CARTO
- coordenadas GPS procedentes de los registros locales

No sustituir esta arquitectura por `react-native-maps` salvo que exista una razón concreta y el cambio sea solicitado explícitamente.

La clave de API de CARTO se proporciona mediante la configuración de entorno correspondiente de Expo/EAS. **No incluir nunca la clave real directamente en el código fuente.**

---

## 8. Vídeo

La funcionalidad de vídeo **no es necesaria actualmente para la detección normal de matrículas**, pero se conserva deliberadamente la capacidad relacionada con vídeo para posibles desarrollos futuros.

Posibles funcionalidades futuras:

- captura continua de cámara/vídeo
- extracción de fotogramas sucesivos
- OCR local sobre fotogramas sucesivos
- detección continua de matrículas

Por este motivo, no eliminar `expo-video` ni la capacidad relacionada con vídeo únicamente porque actualmente no aparezca utilizada por una pantalla visible.

Antes de eliminar dependencias de vídeo, comprobar si se conservan intencionadamente para esta futura funcionalidad.

---

## 9. PDF

La funcionalidad PDF ha sido **eliminada intencionadamente**.

No restaurar:

- generación de PDF
- informes PDF
- dependencias específicas de PDF
- pantallas o utilidades relacionadas con PDF

Las estadísticas deben gestionarse mediante los datos de la aplicación y la exportación CSV.

---

## 10. QR

La funcionalidad QR ha sido **eliminada intencionadamente**.

No restaurar:

- generación de códigos QR
- lectura de QR
- estructuras de datos relacionadas con QR
- dependencias específicas de QR
- scripts relacionados con QR

Si una funcionalidad futura solicita explícitamente QR, añadirlo únicamente para esa funcionalidad.

---

## 11. Estadísticas

La aplicación dispone de una sección de estadísticas que incluye:

- TOP 5
- acceso horizontal a resultados adicionales
- visualización de ubicaciones mediante mapa
- búsqueda de una matrícula individual
- zonas de exclusión para las estadísticas

Las estadísticas deben funcionar a partir de los datos locales de la aplicación.

No introducir un backend de analítica remota salvo que se solicite explícitamente.

---

## 12. Secciones principales de la aplicación

Actualmente existen cuatro áreas principales:

### CÁMARA

- OCR local
- introducción manual de matrícula
- captura GPS
- creación de registros locales

### HISTORIAL

- lista vertical de registros
- pulsar un registro para editarlo

### ESTADÍSTICAS

- TOP 5
- resultados adicionales
- mapa
- búsqueda de matrículas
- zonas de exclusión

### AJUSTES

- importación CSV
- exportación CSV
- configuración relacionada con los datos
- configuración de zonas de exclusión

Conservar esta estructura general salvo que un requisito futuro solicite expresamente cambiarla.

---

## 13. Política de dependencias

Antes de añadir una dependencia:

1. Comprobar si la funcionalidad puede implementarse con el stack actual de Expo/React Native.
2. Comprobar si alguna dependencia ya instalada proporciona esa capacidad.
3. Añadir una dependencia nueva únicamente cuando aporte una utilidad real.
4. No añadir infraestructura backend para una funcionalidad local.
5. No restaurar dependencias eliminadas intencionadamente salvo que la nueva funcionalidad realmente las necesite.
6. Preferir la implementación más pequeña que resuelva el requisito.

Antes de eliminar una dependencia:

1. Buscar usos e imports en todo el repositorio.
2. Comprobar archivos de configuración y plugins de Expo.
3. Comprobar los requisitos futuros documentados en este archivo.
4. Confirmar que su eliminación no rompe ninguna funcionalidad existente.

---

## 14. Regla arquitectónica importante para futuros agentes

La existencia de archivos antiguos, documentación antigua, dependencias antiguas o patrones procedentes de la plantilla original **no significa que esos sistemas sigan siendo necesarios**.

El repositorio puede contener restos de infraestructura utilizada anteriormente.

Antes de restaurar un sistema, determinar si realmente forma parte de la aplicación actual.

En particular:

> **No recrear Express + tRPC + OAuth + base de datos + JWT simplemente porque una nueva funcionalidad parezca susceptible de implementarse mediante un backend.**

Primero determinar si la funcionalidad puede mantenerse local.

---

## 15. Nuevas funcionalidades

Al implementar una nueva funcionalidad, comprobar primero:

- ¿Puede hacerse localmente?
- ¿Necesita datos persistentes locales?
- ¿Necesita GPS?
- ¿Necesita CSV?
- ¿Necesita el mapa?
- ¿Necesita realmente un servicio remoto?
- ¿Necesita realmente cuentas de usuario?
- ¿Necesita realmente una base de datos?

### Solo introducir infraestructura cuando esté justificado.

Si una funcionalidad futura necesita algo que fue eliminado intencionadamente, se puede volver a añadir.

Por ejemplo:

- Un requisito futuro de login puede justificar infraestructura de autenticación.
- Un requisito de sincronización en la nube puede justificar una API/backend.
- Un requisito de base de datos multi-dispositivo puede justificar una base de datos.
- Un requisito futuro de QR puede justificar dependencias QR.
- Un requisito futuro de informes PDF puede justificar herramientas PDF.

Estas incorporaciones deben limitarse al requisito nuevo y no restaurar automáticamente toda la infraestructura de la plantilla original.

---

## 16. Filosofía de limpieza

El proyecto debe mantenerse lo más pequeño, claro y comprensible posible.

La infraestructura de plantilla que ya no se utiliza debe eliminarse en lugar de conservarse "por si acaso".

Sin embargo, las capacidades futuras que se hayan decidido conservar intencionadamente —especialmente vídeo/detección continua— deben mantenerse cuando sus dependencias sean razonables y su finalidad futura esté documentada aquí.

La prioridad es:

**simple → local → fiable → mantenible → ampliable cuando realmente sea necesario.**

---

## 17. Instrucción para MANUS

Antes de modificar el proyecto:

1. Leer `ARCHITECTURE.md`.
2. Respetar las decisiones arquitectónicas descritas aquí.
3. No reintroducir automáticamente infraestructura eliminada.
4. Mantener el procesamiento local siempre que sea posible.
5. Si una nueva funcionalidad exige realmente una excepción a esta arquitectura, explicar qué componente adicional se necesita y por qué antes de realizar cambios arquitectónicos importantes.
6. Evitar refactorizaciones amplias cuando un cambio localizado sea suficiente.