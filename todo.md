# TODO - Detector de Matrículas

## Backend
- [x] Crear endpoint tRPC para detección de matrículas con IA multimodal
- [x] Implementar validación de formato de matrículas españolas
- [x] Implementar manejo de errores y respuestas

## Frontend - Cámara y Captura
- [x] Leer documentación de expo-camera
- [x] Implementar pantalla de captura con vista previa de cámara
- [x] Agregar botón de captura con feedback háptico
- [x] Implementar indicador de estado (listo/procesando/detectado)
- [x] Agregar permisos de cámara

## Frontend - Detección y Resultado
- [x] Implementar pantalla de resultado de detección
- [x] Mostrar imagen capturada con matrícula
- [x] Mostrar texto de matrícula detectada
- [x] Mostrar nivel de confianza
- [x] Implementar edición manual de matrícula
- [x] Agregar botones: Guardar, Descartar, Reintentar

## Frontend - Almacenamiento
- [x] Leer documentación de expo-file-system
- [x] Implementar función para guardar matrículas en archivo de texto
- [x] Implementar almacenamiento de historial en AsyncStorage
- [x] Agregar timestamp a cada matrícula guardada

## Frontend - Historial
- [x] Implementar pantalla de historial con lista de matrículas
- [x] Mostrar matrícula, fecha, hora en cada elemento
- [x] Implementar barra de búsqueda
- [x] Implementar eliminación individual de entradas
- [x] Implementar función de exportar archivo de texto
- [x] Integrar sistema de compartir nativo

## UI/UX
- [x] Actualizar tema de colores según design.md
- [x] Implementar navegación entre pantallas
- [x] Agregar iconos a la barra de navegación
- [x] Implementar feedback visual para estados de carga
- [ ] Agregar animaciones sutiles de transición
- [x] Implementar modo oscuro

## Testing y Validación
- [ ] Probar captura de cámara en dispositivo real
- [ ] Probar detección con matrículas reales
- [x] Validar formato de matrículas españolas
- [ ] Probar exportación de archivo
- [ ] Probar sistema de compartir
- [ ] Validar persistencia de datos

## Estadísticas (Nueva Funcionalidad)
- [x] Crear pantalla de estadísticas con tabs
- [x] Calcular total de matrículas detectadas
- [x] Implementar gráfico de actividad por día
- [x] Implementar gráfico de actividad por mes
- [x] Mostrar recuentos diarios en tabla
- [x] Mostrar recuentos mensuales en tabla
- [x] Agregar tab a la navegación inferior
- [x] Integrar estadísticas con datos existentes


## Detección Automática (Nuevas Mejoras)
- [x] Implementar detección continua sin botón de captura
- [x] Agregar sistema de alertas visuales y hápticas
- [x] Implementar notificación cuando se detecte matrícula válida
- [x] Implementar notificación de registro exitoso
- [x] Mantener vista de captura después de registrar

## Geolocalización
- [x] Leer documentación de expo-location
- [x] Implementar permisos de ubicación
- [x] Capturar coordenadas GPS con cada foto
- [x] Agregar fallback "NO GPS" cuando no esté disponible
- [x] Guardar ubicación en historial

## Agrupación de Matrículas
- [x] Modificar estructura de datos para agrupar matrículas únicas
- [x] Contar repeticiones de cada matrícula
- [x] Actualizar pantalla de historial para mostrar agrupación
- [x] Modificar archivo de texto con formato agrupado

## Exportación a PDF
- [x] Instalar dependencia de generación PDF
- [x] Crear generador de reporte PDF
- [x] Incluir gráficos en PDF
- [x] Incluir tablas de estadísticas
- [x] Incluir información de matrículas únicas
- [x] Implementar función de exportar PDF desde estadísticas


## Optimizaciones (Fase 2)
- [x] Cambiar a modo video continuo en lugar de capturas cada segundo
- [x] Implementar detección visual de marco (verde al intuir matrícula)
- [x] Agregar botón manual de captura si no detecta en 3 segundos
- [x] Optimizar velocidad de registro (reducir latencia)
- [x] Implementar actualización automática de historial al acceder
- [x] Simplificar estadísticas: solo top 5 + total único
- [x] Agregar detalle de matrícula al pulsar (fecha, hora, ubicación)
- [x] Remover estadísticas innecesarias


## Cambios Finales (Fase 3)
- [x] Eliminar detección automática de video
- [x] Mantener solo captura manual con botón
- [x] Simplificar estadísticas (remover "Total de detecciones")
- [x] Aplicar estilo principal a "Matrículas únicas"
- [x] Implementar scroll infinito en listado de matrículas
- [x] Colorear diferente los top 5 elementos
- [x] Anclar header "Top 5 Matrículas" al hacer scroll
- [x] Auto-actualizar estadísticas tras nueva detección
- [x] Auto-actualizar historial tras nueva detección


## Mejoras Finales (Fase 4)
- [x] Eliminar botón de historial de vista de cámara
- [x] Mejorar botón de captura con doble borde blanco
- [x] Agregar icono de cámara al botón
- [x] Optimizar velocidad de procesamiento
- [x] Corregir ordenamiento del Top 5 (mayor a menor)
- [x] Implementar vista de mapa al pulsar GPS


## Cambios Finales (Fase 5)
- [x] Ordenar historial por fecha de detección (más reciente primero)
- [x] Implementar zoom con pinch en vista de cámara
- [x] Mejorar alertas: ✓ para nuevas, ✓ + icono para duplicadas
- [x] Corregir crash de mapa usando Google Maps URL
- [x] Exportar a CSV con formato Excel
- [x] Colores personalizados en TOP 5: #1 amarillo, #2 gris, #3 naranja


## Mejoras Finales (Fase 6)
- [x] Mejorar zoom pinch (separar dedos amplía hasta 200%, juntar reduce)
- [x] Mantener nivel de zoom actual al soltar gesto
- [x] Alertas con colores: VERDE para nuevas, ROJO para duplicadas
- [ ] Integrar OCR local (tesseract-ocr o similar)
- [x] Notificar falta de conexión a internet
- [x] Notificar GPS inactivo


## Cambios Finales (Fase 7)
- [x] Eliminar alertas repetitivas de conexión e internet
- [x] Mantener solo indicador visual de GPS en vista de cámara
- [x] Agregar función de mapa en pantalla de historial
- [x] Crear pantalla de bienvenida/onboarding
- [x] Implementar opción para activar datos móviles
- [x] Implementar opción para activar GPS
- [x] Mejorar formato CSV con columna unificada LATITUD/LONGITUD


## Optimizaciones Finales (Fase 8)
- [x] Implementar monitoreo eficiente de GPS sin bucles
- [x] Usar listeners de eventos para cambios de GPS
- [x] Simplificar alertas: remover icono información
- [x] Mantener ✓ y ⚠️ para duplicadas
- [x] Corregir formato CSV a "lat,lon" en una celda
- [x] Maximizar operaciones locales
- [x] Minimizar dependencias en nube


## Correcciones Críticas (Fase 9)
- [x] Corregir listeners de GPS para actualizar en tiempo real
- [x] Arreglar formato CSV: "40.45330,-3.86069" (punto decimal)
- [x] Remover subrayado de GPS en historial
- [x] Igualar estilo GPS historial con estadísticas
- [x] Ordenar Top 5 descendente (mayor a menor)
- [ ] Implementar modo batch de captura


## Mejoras de UI (Fase 10)
- [x] Eliminar fondo gris bajo botón de captura
- [x] Cambiar marco a color azul (#0066CC)
- [x] Agregar texto informativo bajo marco
- [x] Eliminar icono de flecha durante procesamiento
- [x] Cambiar GPS a bullet rojo/verde (⦿)
- [x] Simplificar alerta (solo ✓ y ⚠️)
- [x] Implementar multi-selección en historial con long-press


## Ajustes Finales (Fase 11)
- [x] Agregar texto "GPS activo" o "GPS inactivo" junto al icono ⦿
- [x] Hacer transparente el fondo del componente del botón de captura


## Limpieza y Optimización (Fase 12)
- [x] Eliminar código de símbolo de alerta en index.tsx
- [x] Eliminar código de pinch que no funciona
- [x] Limpiar código no utilizado en todo el proyecto
- [x] Modificar background en theme.config.js a transparencia 50%


## Ajustes de Background (Fase 13)
- [x] Restaurar background a #ffffff y #151718 (sin transparencia)
- [x] Eliminar background del componente del botón de captura
- [x] Mantener botón sobre cámara sin fondo
- [x] Fondo opaco solo en tab bar


## Mejoras de Historial (Fase 14)
- [x] Ordenar historial por fecha más reciente primero
- [x] Agregar radio buttons "En la acera" y "En doble fila"
- [x] Mostrar etiqueta "ACERA" o "DOBLE FILA" en lista
- [x] Implementar long press para editar matrícula
- [x] Actualizar estructura de datos para guardar ubicación de estacionamiento


## Mejoras de Interfaz (Fase 15)
- [x] Mostrar fecha/hora en elementos de lista del historial
- [x] Mostrar ubicación (ACERA/DOBLE FILA/Sin definir) en elementos de lista
- [x] Eliminar texto "Mantén pulsado para editar" en detalle de historial
- [x] Formatear GPS en BOLD en detalle de historial
- [x] Agregar información de ubicación en detalle de estadísticas
- [x] Actualizar exportación CSV con columna LUGAR (AC/DF/SD)


## Mejoras de Historial (Fase 16)
- [x] Mostrar ubicación real en lista (En la acera/En doble fila) en lugar de "Sin definir"
- [x] Refrescar historial al volver de editar elemento
- [x] Implementar alerta de patrón: 5 detecciones misma matrícula en radio 50m
- [x] Alertar cada 5 nuevas detecciones en misma ubicación y matrícula


## Integración de Mapa Nativo (Fase 17)
- [x] Integrar plate-map.tsx en historial.tsx
- [x] Reemplazar openURL de Google Maps con navegación a plate-map
- [x] Pasar parámetros: latitude, longitude, plate


## Correcciones y Mejoras (Fase 18)
- [x] Eliminar símbolo ⚠️ de línea 193 en index.tsx
- [x] Diagnosticar y corregir cierre inesperado en plate-map.tsx
- [x] Permitir seleccionar ubicación (acera/doble fila) sin modal en historial
- [x] Modal solo para editar matrícula, no para ubicación


## Resoluci\u00f3## Resolución de Build Android (Fase 19)
- [x] Eliminar pnpm-lock.yaml y regenerarlo
- [x] Verificar compatibilidad de pnpm con EAS
- [x] Ejecutar pnpm install sin conflictos
- [x] Confirmar versiones compatibles con Expo 54
- [x] Crear eas.json con configuración optimizada

## Mejoras de Interfaz y GPS (Fase 20)
- [x] Eliminar etiquetas de confianza (alta/media/baja) en stats.tsx e history.tsx
- [x] Agregar botón rojo con X para eliminar elementos de detalle
- [x] Implementar long-press en GPS para editar ubicación en mapa
- [x] Optimizar actualización de posición GPS en captura


## Correcciones de GPS y Cámara (Fase 21)
- [x] Reemplazar long-press con icono de edición (lápiz) en GPS
- [x] Implementar mapa interactivo para editar coordenadas GPS
- [x] Diagnosticar y solucionar cámara en negro
- [x] Ampliar radio de detección de patrón a 100 metros


## Diagnóstico y Solución de GPS (Fase 22)
- [x] Diagnosticar problema de edición de GPS al pulsar lápiz
- [x] Implementar solución: Google Maps para copiar coordenadas
- [x] Crear habilidad reutilizable con skill-creator


## Diagnóstico y Popup de GPS (Fase 23)
- [x] Diagnosticar por qué no funciona botón "Ingresar coordenadas"
- [x] Crear popup modal para editar coordenadas GPS
- [x] Integrar popup en history.tsx


## Correcciones de UX y Limpieza (Fase 24)
- [x] Eliminar Alert View problemático en edición de GPS
- [x] Abrir modal directamente al pulsar lápiz
- [x] Agregar versión de app en esquina superior izquierda
- [x] Limpiar código no utilizado del proyecto


## Correcciones de Modal GPS y Versión (Fase 25)
- [x] Diagnosticar y corregir apertura del modal de GPS
- [x] Unificar campos de latitud/longitud en un solo input
- [x] Implementar parser de coordenadas en formato Google Maps
- [x] Mover versión de app a vista de Cámara
- [x] Eliminar versión de vista de Historial


## Corrección de Renderización de GPSEditorModal (Fase 26)
- [ ] Diagnosticar early returns en history.tsx
- [ ] Reestructurar componente con fragmento para renderizar modal siempre
- [ ] Verificar funcionalidad del modal en todas las vistas


## Diagnóstico de Problemas Críticos (Fase 27)
- [x] Problema 1: Cámara en negro al volver a vista principal - agregar delay en useFocusEffect
- [x] Problema 2: GPS no se actualiza al cambiar ubicación - reducir timeInterval a 1s y distanceInterval a 5m
- [x] Problema 3: Modal entrada manual no responde - agregar flag isQuickEntryProcessing


## Problemas Reportados (Fase 28)
- [x] Problema 1: Entrada rápida tarda mucho en abrirse - mostrar modal inmediatamente sin esperar GPS
- [x] Problema 2: Números de posición en TOP 5 incorrectos - cambiar a selectedPlate.entries.length - index


## Mejoras Solicitadas (Fase 29)
- [x] Tarea 1: Eliminar todos los sonidos de la aplicación - removidas 13 llamadas de Haptics
- [x] Tarea 2: Permitir entrada manual durante procesamiento - estado isDetecting separado


## Correcciones Adicionales (Fase 30)
- [x] Corregir numeración de detecciones en Historial: cambiar a selectedPlate.entries.length - index


## Cambios en Validación de Matrícula (Fase 31)
- [x] Cambiar placeholder a "Ej: 0000BBB"
- [x] Actualizar regex a /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/
- [x] Cambiar borde a rojo si no cumple formato, azul si cumple


## Corrección de UI: Header Anclado con Icono de Mapa (Fase 43)
- [x] Reestructurar header anclado en pantalla de detalle (Historial)
- [x] Mover icono de mapa del modal al header anclado
- [x] Eliminar icono de mapa del modal de edición
- [x] Aplicar mismo diseño a TOP 5 Matrículas en Estadísticas


## Implementación de Pantalla de Mapa (Fase 44)
- [x] Instalar react-native-webview compatible con SDK 54
- [x] Crear pantalla de Mapa (app/(tabs)/map.tsx) con header anclado
- [x] Implementar Leaflet con CartoDB DarkMatter
- [x] Crear pines azules (acera) y naranjas (doble fila)
- [x] Implementar búsqueda de matrículas con validación
- [x] Crear modal de detalle al tocar pin
- [x] Integrar navegación desde Historial (icono mapa)
- [x] Integrar navegación desde Estadísticas (icono mapa en TOP 5)
- [x] Integrar navegación desde Estadísticas (botón "Ver Mapa")
- [x] Pasar parámetros de ruta (plate) correctamente
- [x] Implementar filtrado automático si hay parámetro
- [x] Implementar botón "Ver Todas las Detecciones"


## Correcciones Críticas de WebView (Fase 45)
- [x] Reestructurar navegación: mover map.tsx de (tabs) a root
- [x] Registrar como Stack Navigator Modal (presentation: "modal")
- [x] Corregir WebView con flex:1 y backgroundColor
- [x] Implementar MarkerCluster con colores por densidad
- [x] Agregar useFocusEffect para actualización en tiempo real
- [x] Agregar ActivityIndicator durante carga

## Correcciones Técnicas de WebView (Fase 46)
- [x] Agregar imports faltantes (View, Text, TextInput, etc.)
- [x] Corregir CSS del HTML: 100vh en lugar de 100%
- [x] Implementar try-catch en JavaScript
- [x] Validar que ActivityIndicator se oculta correctamente
- [x] Verificar Stack Navigator registrado correctamente

## Corrección de Lógica de Coordenadas (Fase 47 - ACTUAL)
- [x] Corregir parseo de coordenadas en HTML del mapa
- [x] Manejar tanto objetos como strings de coordenadas
- [x] Validar coordenadas numéricas correctamente
- [x] Filtrar entradas sin GPS
- [x] Aplicar CSS crítico: position: absolute + height: 100%
- [x] Implementar carga asíncrona de datos (map-ready event)
- [x] Agregar minHeight: 500 en WebView
- [x] Agregar androidLayerType="hardware"
- [x] Implementar window.onerror para capturar errores nativos
- [ ] Verificar que el mapa renderiza correctamente en dispositivo
- [ ] Probar clustering con múltiples marcadores
- [ ] Probar filtrado por matrícula


## Test de Visibilidad y Fuerza Bruta (Fase 48 - ACTUAL)
- [x] Crear HTML de prueba con fondo rojo y texto "PRUEBA DE RENDERIZADO"
- [x] Eliminar Leaflet temporalmente para aislar problema
- [x] Forzar dimensiones en View: flex: 1, height: '100%', width: '100%', backgroundColor: 'blue'
- [x] Forzar dimensiones en WebView: flex: 1, height: '100%', width: '100%'
- [x] Usar HTML como constante (const MAP_HTML = ...)
- [x] Usar source={{ html: MAP_HTML }} en lugar de URL
- [x] Agregar logs en onLoad, onLoadEnd, onMessage
- [ ] Verificar si pantalla es ROJA (WebView funciona) o BLANCA (problema React Native)
- [ ] Si ROJA: Agregar Leaflet paso a paso
- [ ] Si BLANCA: Revisar estructura de contenedor React Native


## Reinstalación y Código Minimalista (Fase 49 - ACTUAL)
- [x] Ejecutar npx expo install react-native-webview
- [x] Verificar que react-native-webview@13.15.0 está en package.json
- [x] Reemplazar app/map.tsx con código minimalista de prueba
- [x] Componente con View rojo + header negro + WebView amarillo
- [x] Botón "VOLVER" en header para confirmar que pantalla carga
- [ ] Probar en dispositivo real:
  - Si ves NEGRO arriba y AMARILLO abajo: Problema era código anterior (Leaflet)
  - Si ves TODO BLANCO: Problema es react-native-webview o navegación
- [ ] Basado en resultado, agregar Leaflet o revisar instalación


## Mapa Funcional Completado (Fase 50 - FINAL)
- [x] Agregar Stack.Screen para plate-map en app/_layout.tsx
- [x] Reescribir app/plate-map.tsx con Leaflet + Clustering
- [x] Implementar Header con buscador y botón "Mostrar"
- [x] Implementar WebView con HTML inyectado
- [x] Clustering con colores: Verde (#83b867), Amarillo (#ffe373), Naranja (#f59a71), Rojo (#e6575c)
- [x] Pines: Azul (Acera) y Naranja (Doble Fila)
- [x] Modal de detalle al tocar pines
- [x] Búsqueda de matrículas con validación
- [x] Filtrado automático desde parámetros de ruta
- [x] Botón "Ver Todas las Detecciones"
- [x] Navegación desde Estadísticas (stats.tsx) con params
- [x] Navegación desde Historial (history.tsx) con params
- [x] ActivityIndicator durante carga
- [x] Logs en consola para debugging
- [ ] Probar en dispositivo real
- [ ] Verificar que mapa renderiza correctamente
- [ ] Verificar clustering con múltiples marcadores
- [ ] Verificar filtrado por matrícula


## Correcciones de UI y Carga (Fase 51 - ACTUAL)
- [x] Importar useSafeAreaInsets de react-native-safe-area-context
- [x] Agregar paddingTop: insets.top al View principal
- [x] Eliminar setIsLoading(false) de onLoad y onLoadEnd
- [x] Agregar setIsLoading(false) solo en onMessage tipo map-loaded
- [x] Retraso de 500ms antes de inyeccion de datos
- [x] Verificar filteredEntries vs allEntries en loadMapData
- [x] Agregar zIndex: 2000 al modal de detalle
- [x] Sincronizacion correcta de cargador con Leaflet
- [ ] Probar en dispositivo real
- [ ] Verificar que header no se oculta tras barra de estado
- [ ] Verificar que cargador desaparece solo cuando mapa esta listo
- [ ] Verificar que modal aparece sobre cargador


## Reestructuracion Completa de Mapa (Fase 52 - ACTUAL)
- [x] Importar useSafeAreaInsets
- [x] Aplicar paddingTop: insets.top y paddingBottom: insets.bottom
- [x] Desmontaje completo del cargador cuando isLoading es false
- [x] setIsLoading(false) SOLO en onMessage tipo map-loaded
- [x] Diferenciacion de vistas: Caso A (con params.plate) vs Caso B (sin params.plate)
- [x] Caso A: Vista de matricula especifica con info estilizada
- [x] Caso A: Ocultar TextInput y boton Mostrar
- [x] Caso A: Mostrar boton Ver Todas las Detecciones
- [x] Caso B: Vista general con TextInput de busqueda
- [x] Caso B: Mantener boton Mostrar funcional
- [x] Caso B: Boton Ver Todas las Detecciones ancho
- [x] window.onerror mejorado con lineNo y columnNo
- [x] Retraso de 500ms en map-ready antes de inyectar datos
- [x] Modal con paddingBottom: Math.max(16, insets.bottom)
- [ ] Probar en dispositivo real
- [ ] Verificar que SafeArea funciona correctamente
- [ ] Verificar diferenciacion de vistas
- [ ] Verificar que cargador se desmonta correctamente


## Reestructuracion Final (Fase 53 - ACTUAL)
- [x] Failsafe de carga: setIsLoading(false) en map-ready + 600ms
- [x] Separacion estricta: Eliminar boton Ver Todas en vista de matricula
- [x] Separacion estricta: Mantener boton Ver Todas en vista general
- [x] Sincronizacion: filteredEntries = allEntries si no hay params.plate
- [x] Sincronizacion: Enviar allEntries si filteredEntries vacio
- [x] SafeArea confirmado: paddingTop + paddingBottom en View raiz
- [x] Comentarios explicativos en codigo
- [ ] Probar en dispositivo real
- [ ] Verificar que UI no se bloquea durante carga
- [ ] Verificar separacion de vistas funciona correctamente
- [ ] Verificar que failsafe desactiva cargador
