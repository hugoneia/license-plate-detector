# Hallazgos de Investigación - APIs de OCR para Detección de Matrículas

## Resumen Ejecutivo

Para la detección de matrículas españolas en una aplicación móvil Expo/React Native, la solución más práctica es utilizar el **servidor backend integrado con capacidades de IA multimodal** que ya está disponible en el proyecto. Esta aproximación evita las complejidades de integrar librerías nativas de OCR y aprovecha las capacidades de visión por computadora del LLM del servidor.

## Opciones Evaluadas

### 1. Librerías Nativas de OCR (Tesseract)

**Paquetes encontrados:**
- `@devinikhiya/react-native-tesseractocr`
- `react-native-tesseract-ocr`

**Ventajas:**
- Procesamiento local en el dispositivo
- No requiere conexión a internet
- Sin costos de API externa

**Desventajas:**
- Requiere configuración nativa compleja (archivos .traineddata en carpetas específicas de Android/iOS)
- No funciona directamente con Expo Go (requiere custom development build)
- Precisión limitada para matrículas sin entrenamiento específico
- Archivos de idioma grandes que aumentan el tamaño de la app
- Mantenimiento complejo de dependencias nativas

**Veredicto:** No recomendado para este proyecto debido a la complejidad de configuración y limitaciones con Expo.

### 2. Librerías de Detección de Matrículas Especializadas

**Paquetes encontrados:**
- `react-native-openalpr` (iOS only, desactualizado)
- `react-native-vision-camera` con Frame Processors + TFLite

**Ventajas:**
- Mayor precisión para matrículas específicamente
- Procesamiento en tiempo real

**Desventajas:**
- Requieren configuración nativa muy compleja
- Problemas de compatibilidad con Expo (según post de Reddit)
- Dificultades con Skia para dibujar bounding boxes
- Modelos TFLite requieren integración manual
- No funcionan en Expo Go

**Veredicto:** Demasiado complejo para el alcance del proyecto y no compatible con Expo sin custom builds.

### 3. Backend con IA Multimodal (SOLUCIÓN RECOMENDADA)

**Descripción:**
El proyecto ya incluye un servidor backend con capacidades de IA multimodal que puede analizar imágenes y extraer texto.

**Ventajas:**
- Ya está integrado en el proyecto (no requiere configuración adicional)
- Funciona perfectamente con Expo Go
- IA multimodal puede detectar y leer matrículas con alta precisión
- Puede manejar casos complejos (ángulos, iluminación, etc.)
- Procesamiento más potente que en dispositivo móvil
- No aumenta el tamaño de la app
- Fácil de mantener y actualizar

**Desventajas:**
- Requiere conexión a internet
- Latencia de red (mitigable con feedback visual)

**Implementación:**
1. Usuario captura foto con `expo-camera`
2. Imagen se envía al servidor backend vía tRPC
3. Servidor usa IA multimodal para analizar la imagen y extraer texto de matrícula
4. Servidor valida formato de matrícula española
5. Resultado se devuelve a la app
6. App guarda matrícula en archivo de texto local usando `expo-file-system`

**Formato de matrículas españolas:**
- Formato actual (desde 2000): 4 dígitos + 3 letras (ej: 1234 ABC)
- Formato antiguo: 1-2 letras + 4 dígitos + 1-2 letras (ej: M 1234 AB)

## Decisión Final

**Usar el servidor backend con IA multimodal** es la solución óptima porque:

1. **Simplicidad**: No requiere configuración nativa compleja
2. **Compatibilidad**: Funciona con Expo Go sin custom builds
3. **Precisión**: La IA multimodal puede entender contexto visual mejor que OCR básico
4. **Mantenibilidad**: Código más simple y fácil de mantener
5. **Escalabilidad**: Fácil mejorar el modelo o agregar validaciones en el servidor
6. **Ya disponible**: El servidor con IA ya está configurado en el proyecto

## Arquitectura Propuesta

```
[App Móvil]
    ↓ (1) Usuario captura foto
[expo-camera]
    ↓ (2) Imagen en base64
[tRPC Client]
    ↓ (3) POST /api/trpc/detectLicensePlate
[Servidor Backend]
    ↓ (4) Análisis con IA multimodal
[LLM con Visión]
    ↓ (5) Texto de matrícula + confianza
[Validación formato español]
    ↓ (6) Resultado validado
[tRPC Response]
    ↓ (7) Matrícula detectada
[App Móvil]
    ↓ (8) Guardar en archivo
[expo-file-system]
    ↓ (9) Archivo de texto actualizado
[AsyncStorage para historial]
```

## Módulos Expo Necesarios

Según la documentación local de Expo SDK 54:

1. **`media/camera/DOCS.md`**: Para capturar fotos de matrículas
2. **`storage/filesystem/DOCS.md`**: Para guardar el archivo de texto con matrículas
3. **`storage/blob/DOCS.md`**: Para convertir imágenes a formato adecuado para envío
4. **`communication/sharing/DOCS.md`**: Para compartir el archivo de texto exportado
5. **`ui/haptics/DOCS.md`**: Para feedback táctil en captura

## Próximos Pasos

1. Leer documentación de `expo-camera` en `/home/ubuntu/license-plate-detector_helper/docs/media/camera/DOCS.md`
2. Leer documentación de `expo-file-system` en `/home/ubuntu/license-plate-detector_helper/docs/storage/filesystem/DOCS.md`
3. Implementar endpoint tRPC en el servidor para detección de matrículas
4. Implementar UI de captura de cámara
5. Implementar pantalla de resultado con validación
6. Implementar pantalla de historial con lista de matrículas
7. Implementar exportación de archivo de texto
