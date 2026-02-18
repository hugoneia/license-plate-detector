# Diseño de Interfaz - Detector de Matrículas

## Orientación y Uso
- **Orientación**: Retrato móvil (9:16)
- **Uso**: Una mano
- **Plataforma**: iOS/Android siguiendo Apple Human Interface Guidelines

## Lista de Pantallas

### 1. Pantalla Principal (Home)
**Contenido principal**:
- Vista previa de la cámara en tiempo real (ocupa la mayor parte de la pantalla)
- Botón de captura grande y prominente en la parte inferior central
- Indicador visual de estado (listo/procesando/detectado)
- Contador de matrículas detectadas en la sesión actual

**Funcionalidad**:
- Acceso directo a la cámara
- Captura de foto para detección
- Feedback visual inmediato tras la captura
- Navegación a la lista de matrículas detectadas

### 2. Pantalla de Resultado de Detección
**Contenido principal**:
- Imagen capturada con la matrícula resaltada
- Texto de la matrícula detectada en formato grande y legible
- Nivel de confianza de la detección
- Botones de acción: Guardar, Descartar, Reintentar

**Funcionalidad**:
- Visualización del resultado de OCR
- Confirmación o corrección manual del texto detectado
- Guardar la matrícula en el archivo de texto

### 3. Pantalla de Historial
**Contenido principal**:
- Lista de matrículas detectadas ordenadas por fecha/hora
- Cada elemento muestra: matrícula, fecha, hora, miniatura de la foto
- Barra de búsqueda en la parte superior
- Botón para exportar el archivo de texto

**Funcionalidad**:
- Visualización de todas las matrículas guardadas
- Búsqueda y filtrado de matrículas
- Eliminación individual de entradas
- Exportación del archivo de texto completo
- Compartir el archivo mediante el sistema de compartir nativo

## Flujos de Usuario Principales

### Flujo 1: Detectar Nueva Matrícula
1. Usuario abre la app → Pantalla Principal con cámara activa
2. Usuario apunta la cámara a una matrícula
3. Usuario toca el botón de captura
4. App procesa la imagen (indicador de carga)
5. App muestra Pantalla de Resultado con la matrícula detectada
6. Usuario confirma → Matrícula se guarda en el archivo de texto
7. Usuario regresa a Pantalla Principal para continuar

### Flujo 2: Ver Historial y Exportar
1. Usuario toca el ícono de historial en la barra de navegación
2. App muestra Pantalla de Historial con lista de matrículas
3. Usuario puede buscar/filtrar matrículas específicas
4. Usuario toca botón "Exportar"
5. App genera archivo de texto plano
6. Sistema muestra opciones de compartir (email, guardar en archivos, etc.)

### Flujo 3: Corregir Detección Incorrecta
1. Desde Pantalla de Resultado, usuario ve texto incorrecto
2. Usuario toca el texto de la matrícula
3. Aparece teclado para edición manual
4. Usuario corrige el texto
5. Usuario confirma → Matrícula corregida se guarda

## Elección de Colores

### Paleta Principal
- **Primary (Acento)**: `#0066CC` (Azul matrícula europea)
  - Representa las matrículas españolas con banda azul
  - Usado en botones principales y elementos interactivos
  
- **Background**: 
  - Light: `#F5F5F5` (Gris muy claro)
  - Dark: `#1A1A1A` (Negro suave)
  
- **Surface (Tarjetas)**:
  - Light: `#FFFFFF`
  - Dark: `#2A2A2A`
  
- **Foreground (Texto principal)**:
  - Light: `#1A1A1A`
  - Dark: `#F5F5F5`
  
- **Success**: `#00C853` (Verde) - Para detecciones exitosas
- **Warning**: `#FFB300` (Ámbar) - Para detecciones con baja confianza
- **Error**: `#D32F2F` (Rojo) - Para errores de detección

### Aplicación de Colores
- Botón de captura: Círculo blanco con borde azul primary
- Indicadores de estado: Success/Warning/Error según confianza
- Texto de matrícula detectada: Primary sobre fondo Surface
- Elementos de navegación: Primary para activo, Muted para inactivo

## Consideraciones de Diseño

### Accesibilidad
- Contraste mínimo WCAG AA para todo el texto
- Botones táctiles mínimo 44x44pt
- Feedback háptico en acciones principales
- Soporte completo para modo oscuro

### Interacción
- Gestos: Deslizar hacia abajo para refrescar en Historial
- Animaciones sutiles (200-300ms) para transiciones
- Feedback inmediato en todas las interacciones
- Estados de carga claros durante el procesamiento OCR

### Tipografía
- Títulos: SF Pro Display Bold (iOS) / Roboto Bold (Android)
- Texto de matrícula: Monospace para mejor legibilidad
- Cuerpo: SF Pro Text (iOS) / Roboto (Android)
- Tamaños: 28pt títulos, 16-18pt cuerpo, 14pt secundario
