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
 * - Posición: Lateral derecho, entre marco azul y botón de disparo
 * - Translúcidez dinámica: 0.3 por defecto, 1.0 al tocar
 * - Dirección: Arriba = zoom IN (4x), Centro = 2x, Abajo = zoom OUT (1x)
 * - Etiquetas: Muestra 4x (arriba), 2x (centro), 1x (abajo)
 * - Bola centrada perfectamente sin desplazamientos
 */
export function ZoomSlider({ zoom, onZoomChange, onZoomResetTimer }: ZoomSliderProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const [opacity] = useState(new Animated.Value(0.3));
  const sliderHeightRef = useRef(180); // Altura del slider en píxeles

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
        // CORRECCIÓN: Dirección invertida
        // dy negativo (arriba) = zoom IN (4x)
        // dy positivo (abajo) = zoom OUT (1x)
        // Convertir movimiento vertical a zoom
        const newZoom = Math.max(0, Math.min(0.6, zoom + dy / 300)); // Sensibilidad ajustada
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

  // CORRECCIÓN: Calcular posición del control circular
  // Zoom 0.0 (1x) = 100% (abajo)
  // Zoom 0.3 (2x) = 50% (centro)
  // Zoom 0.6 (4x) = 0% (arriba)
  const controlPosition = 100 - (zoom / 0.6) * 100; // Porcentaje de 0 a 100

  // Calcular zoom visual (1x a 4x)
  const zoomLevel = 1 + (zoom / 0.6) * 3; // 1x a 4x

  return (
    <View
      className="absolute right-4 items-center gap-3"
      style={{
        bottom: 100, // Posicionar entre marco azul y botón de disparo
        width: 40, // Ancho fijo para evitar saltos
      }}
    >
      {/* Etiqueta superior: 4x */}
      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
        4x
      </Text>

      {/* Slider vertical con contenedor fijo */}
      <View
        style={{
          height: sliderHeightRef.current,
          width: 40, // Ancho fijo del contenedor
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            height: sliderHeightRef.current,
            width: 2, // Slider muy delgado
            backgroundColor: colors.primary,
            opacity,
            borderRadius: 1,
          }}
        >
          {/* Control circular - CENTRADO PERFECTAMENTE */}
          <Animated.View
            style={{
              position: "absolute",
              top: `${controlPosition}%`,
              left: -5, // Centrar horizontalmente: (40 - 12) / 2 = 14, pero left: -5 porque está dentro del slider
              transform: [{ translateY: -6 }], // Centrar verticalmente (12 / 2 = 6)
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
      </View>

      {/* Etiqueta central: 2x */}
      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
        2x
      </Text>

      {/* Etiqueta inferior: 1x */}
      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
        1x
      </Text>

      {/* Zoom actual (mostrado mientras se arrastra) */}
      {isPressed && (
        <Text
          style={{ color: colors.primary, marginTop: 4, fontSize: 11, fontWeight: "bold" }}
        >
          {zoomLevel.toFixed(1)}x
        </Text>
      )}
    </View>
  );
}
