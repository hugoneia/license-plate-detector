import React, { useState, useRef } from "react";
import { View, Text, Animated, PanResponder } from "react-native";
import { useColors } from "@/hooks/use-colors";

export interface ZoomSliderProps {
  zoom: number; // Valor entre 0.0 (1x) y 0.6 (4x), default 0.2 (2x)
  onZoomChange: (zoom: number) => void;
  onZoomResetTimer?: (timer: ReturnType<typeof setTimeout> | null) => void;
}

/**
 * Slider de zoom vertical - Lógica pura con PanResponder
 * - Posición: Zona roja inferior derecha (right: 20, bottom: 100)
 * - Dirección: Arriba = zoom IN (4x), Abajo = zoom OUT (1x)
 * - Rango: 0.0 (1x) a 0.6 (4x), default 0.2 (2x)
 * - Translúcidez: 0.3 por defecto, 1.0 al interactuar
 */
export function ZoomSlider({ zoom, onZoomChange, onZoomResetTimer }: ZoomSliderProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const [opacity] = useState(new Animated.Value(0.3));
  const opacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sliderHeight = 160; // Altura del riel en píxeles

  // Calcular zoom visual (1x a 4x)
  const zoomLevel = 1 + (zoom / 0.6) * 3;

  // Calcular posición de la bola (en píxeles desde arriba)
  // zoom 0.6 (4x) = 0px (arriba)
  // zoom 0.3 (2x) = 80px (centro)
  // zoom 0.0 (1x) = 160px (abajo)
  const thumbPosition = (1 - zoom / 0.6) * sliderHeight;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsPressed(true);
        // Mostrar slider (opacidad 1.0)
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 100,
          useNativeDriver: false,
        }).start();

        // Limpiar timer anterior
        if (opacityTimer.current) {
          clearTimeout(opacityTimer.current);
        }
      },
      onPanResponderMove: (_, { dy }) => {
        // LÓGICA CORRECTA:
        // dy negativo (dedo hacia arriba) = zoom aumenta
        // dy positivo (dedo hacia abajo) = zoom disminuye
        // Convertir movimiento en píxeles a valor de zoom
        const newZoom = Math.max(0, Math.min(0.6, zoom - (dy / sliderHeight) * 0.6));
        onZoomChange(newZoom);
      },
      onPanResponderRelease: () => {
        setIsPressed(false);
        // Volver a opacidad baja tras 1 segundo
        opacityTimer.current = setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }, 1000);
        onZoomResetTimer?.(opacityTimer.current);
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        position: "absolute",
        right: 20,
        bottom: 100,
        width: 40,
        height: 200,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {/* Contenedor del slider vertical */}
      <View
        style={{
          width: 40,
          height: 200,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Etiqueta superior: 4x */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: colors.muted,
            marginBottom: 2,
          }}
        >
          4x
        </Text>

        {/* Slider vertical - Zona interactiva */}
        <View
          {...panResponder.panHandlers}
          style={{
            height: sliderHeight,
            width: 40,
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
        >
          {/* Riel vertical (línea de fondo) */}
          <View
            style={{
              position: "absolute",
              width: 2,
              height: sliderHeight,
              backgroundColor: colors.primary,
              borderRadius: 1,
            }}
          />

          {/* Bola (thumb) - Posicionada dinámicamente */}
          <Animated.View
            style={{
              position: "absolute",
              top: thumbPosition,
              left: 14, // Centrar horizontalmente (40 - 12) / 2 = 14
              transform: [{ translateY: -6 }], // Centrar verticalmente (12 / 2 = 6)
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.primary,
              shadowColor: colors.foreground,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 3,
              elevation: 5,
            }}
          />
        </View>

        {/* Etiqueta central: 2x */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: colors.muted,
            marginVertical: 2,
          }}
        >
          2x
        </Text>

        {/* Etiqueta inferior: 1x */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: colors.muted,
            marginTop: 2,
          }}
        >
          1x
        </Text>
      </View>

      {/* Zoom actual (mostrado mientras se arrastra) */}
      {isPressed && (
        <Text
          style={{
            position: "absolute",
            bottom: -28,
            fontSize: 11,
            fontWeight: "bold",
            color: colors.primary,
          }}
        >
          {zoomLevel.toFixed(1)}x
        </Text>
      )}
    </Animated.View>
  );
}
