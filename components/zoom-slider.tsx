import React, { useState, useRef, useEffect } from "react";
import { View, Text, Animated, PanResponder } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";

export interface ZoomSliderProps {
  zoom: number; // Valor entre 0.0 (1x) y 0.6 (4x), default 0.2 (2x)
  onZoomChange: (zoom: number) => void;
  onZoomResetTimer?: (timer: ReturnType<typeof setTimeout> | null) => void;
}

const ZOOM_STORAGE_KEY = "camera_zoom_preference";

/**
 * Slider de zoom vertical - Diseño compacto y posición baja
 * - Posición: Zona inferior derecha (right: 15, bottom: 30)
 * - Altura total: 120px (compacto)
 * - Estructura: Valor + Etiquetas comprimidas (4x, 2x, 1x) + slider vertical
 * - Dirección: Arriba = zoom IN (4x), Abajo = zoom OUT (1x)
 * - Colores: Blanco puro (bola), Blanco 75% (track pasado), Blanco 20% (track futuro)
 * - Translúcidez: 0.2 en reposo, 1.0 al tocar
 * - Rango: 0.0 (1x) a 0.6 (4x), default 0.2 (2x)
 */
export function ZoomSlider({ zoom, onZoomChange, onZoomResetTimer }: ZoomSliderProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const [opacity] = useState(new Animated.Value(0.2)); // 0.2 por defecto
  const opacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const sliderHeight = 100; // Altura del riel reducida a 100px
  const sliderWidth = 3; // Ancho del riel reducido a 3px

  // Calcular zoom visual (1x a 4x)
  const zoomLevel = 1 + (zoom / 0.6) * 3;

  // Calcular posición de la bola (en píxeles desde arriba)
  // zoom 0.6 (4x) = 0px (arriba)
  // zoom 0.3 (2x) = 50px (centro)
  // zoom 0.0 (1x) = 100px (abajo)
  const thumbPosition = (1 - zoom / 0.6) * sliderHeight;

  // Persistencia: Guardar zoom en AsyncStorage
  useEffect(() => {
    const saveZoom = async () => {
      try {
        await AsyncStorage.setItem(ZOOM_STORAGE_KEY, zoom.toString());
      } catch (error) {
        console.error("Error saving zoom:", error);
      }
    };
    saveZoom();
  }, [zoom]);

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
        // dy negativo (dedo hacia arriba) = zoom aumenta (hacia 0.6 = 4x)
        // dy positivo (dedo hacia abajo) = zoom disminuye (hacia 0.0 = 1x)
        const newZoom = Math.max(0, Math.min(0.6, zoom - (dy / sliderHeight) * 0.6));
        onZoomChange(newZoom);
      },
      onPanResponderRelease: () => {
        setIsPressed(false);
        // Volver a opacidad baja (0.2) tras 1 segundo
        opacityTimer.current = setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0.2,
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
        right: 15,
        bottom: 30, // Posición baja, justo arriba del panel
        width: 50,
        height: 120, // Altura total compacta
        opacity,
      }}
    >
      {/* Contenedor principal: Valor + Etiquetas + Slider */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 2,
        }}
      >
        {/* ETIQUETAS (izquierda) - Comprimidas */}
        <View
          style={{
            height: sliderHeight,
            justifyContent: "space-between",
            alignItems: "center",
            width: 16,
          }}
        >
          {/* Etiqueta 4x (arriba) */}
          <Text
            style={{
              fontSize: 8,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              lineHeight: 10,
            }}
          >
            4x
          </Text>

          {/* Etiqueta 2x (centro exacto) */}
          <Text
            style={{
              fontSize: 8,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              lineHeight: 10,
            }}
          >
            2x
          </Text>

          {/* Etiqueta 1x (abajo) */}
          <Text
            style={{
              fontSize: 8,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              lineHeight: 10,
            }}
          >
            1x
          </Text>
        </View>

        {/* SLIDER (derecha) */}
        <View
          {...panResponder.panHandlers}
          style={{
            height: sliderHeight,
            width: 18,
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
        >
          {/* Riel vertical (línea de fondo) - Gris claro */}
          <View
            style={{
              position: "absolute",
              width: sliderWidth,
              height: sliderHeight,
              backgroundColor: "rgba(255, 255, 255, 0.2)", // Blanco 20% opacidad
              borderRadius: 1.5,
            }}
          />

          {/* Riel vertical (línea pasada) - Blanco 75% */}
          <View
            style={{
              position: "absolute",
              width: sliderWidth,
              height: thumbPosition + 5, // Hasta la bola
              top: 0,
              backgroundColor: "rgba(255, 255, 255, 0.75)", // Blanco 75% opacidad
              borderRadius: 1.5,
            }}
          />

          {/* Bola (thumb) - Blanca pura, más pequeña */}
          <Animated.View
            style={{
              position: "absolute",
              top: thumbPosition,
              left: (18 - 10) / 2, // Centrar horizontalmente (18 - 10) / 2 = 4
              transform: [{ translateY: -5 }], // Centrar verticalmente (10 / 2 = 5)
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: "#FFFFFF", // Blanco puro
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.25,
              shadowRadius: 2,
              elevation: 3,
            }}
          />
        </View>
      </View>

      {/* Valor de zoom actual (arriba, en la esquina) */}
      <View
        style={{
          position: "absolute",
          top: -16,
          right: 0,
          width: 30,
          height: 14,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: "bold",
            color: "#FFFFFF", // Blanco puro
            lineHeight: 10,
          }}
        >
          {zoomLevel.toFixed(1)}x
        </Text>
      </View>
    </Animated.View>
  );
}
