import React, { useState, useRef } from "react";
import { View, PanResponder, Animated, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

export interface ZoomSliderProps {
  zoom: number; // Valor entre 0.0 (1x) y 0.6 (4x)
  onZoomChange: (zoom: number) => void;
  onZoomResetTimer?: (timer: ReturnType<typeof setTimeout> | null) => void;
}

/**
 * Slider de zoom vertical minimalista
 * - Posición: Lateral derecho, centrado verticalmente
 * - Translúcidez dinámica: 0.3 por defecto, 1.0 al tocar
 * - Dirección: Arriba = zoom out (1x), Centro = 2x, Abajo = zoom in (4x)
 * - Etiquetas: Muestra 1x, 2x, 4x
 */
export function ZoomSlider({ zoom, onZoomChange, onZoomResetTimer }: ZoomSliderProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const [opacity] = useState(new Animated.Value(0.3));
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
      },
      onPanResponderMove: (_, { dy }) => {
        // Convertir movimiento vertical a zoom (dy negativo = arriba = zoom out)
        // Rango de movimiento: ~200px para todo el rango de zoom
        const newZoom = Math.max(0, Math.min(0.6, zoom - dy / 333.33)); // 200px / 0.6 ≈ 333
        onZoomChange(newZoom);
      },
      onPanResponderRelease: () => {
        setIsPressed(false);
        // Volver a opacidad baja tras 1 segundo
        const timer = setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }, 1000);
        onZoomResetTimer?.(timer);
      },
    })
  ).current;

  // Calcular posición del control circular (0 = arriba, 1 = abajo)
  // Zoom 0.0 (1x) = 0, Zoom 0.3 (2x) = 0.5, Zoom 0.6 (4x) = 1.0
  const controlPosition = (zoom / 0.6) * 100; // Porcentaje de 0 a 100

  // Calcular zoom visual (1x a 4x)
  const zoomLevel = 1 + (zoom / 0.6) * 3; // 1x a 4x

  return (
    <View className="absolute right-4 top-1/2 -translate-y-1/2 items-center gap-2">
      {/* Etiqueta superior: 1x */}
      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
        1x
      </Text>

      {/* Slider vertical */}
      <Animated.View
        {...panResponder.panHandlers}
        className="h-48 w-1 rounded-full"
        style={{
          backgroundColor: colors.primary,
          opacity,
        }}
      >
        {/* Control circular */}
        <Animated.View
          style={{
            position: "absolute",
            top: `${controlPosition}%`,
            left: -6, // Centrar horizontalmente (control es 12x12, slider es 4px)
            transform: [{ translateY: -6 }], // Centrar verticalmente
            height: 12,
            width: 12,
            borderRadius: 6,
            backgroundColor: colors.primary,
            shadowColor: colors.foreground,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 5,
          }}
        />
      </Animated.View>

      {/* Etiqueta central: 2x */}
      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
        2x
      </Text>

      {/* Etiqueta inferior: 4x */}
      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
        4x
      </Text>

      {/* Zoom actual (mostrado mientras se arrastra) */}
      {isPressed && (
        <Text
          style={{ color: colors.primary, marginTop: 8, fontSize: 12, fontWeight: "bold" }}
        >
          {zoomLevel.toFixed(1)}x
        </Text>
      )}
    </View>
  );
}
