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
 * Slider de zoom vertical - Pulido con diseño minimalista
 * - Posición: Zona inferior derecha (right: 20, bottom: 25)
 * - Estructura: Valor arriba + Etiquetas separadas (4x, 2x, 1x) + slider vertical
 * - Dirección: Arriba = zoom IN (4x), Abajo = zoom OUT (1x)
 * - Colores: Blanco puro (bola), Blanco 75% (track pasado), Blanco 20% (track futuro)
 * - Rango: 0.0 (1x) a 0.6 (4x), default 0.2 (2x)
 * - Persistencia: Guardar en AsyncStorage
 */
export function ZoomSlider({ zoom, onZoomChange, onZoomResetTimer }: ZoomSliderProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const [opacity] = useState(new Animated.Value(0.3));
  const opacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const sliderHeight = 160; // Altura del riel en píxeles
  const sliderWidth = 4; // Ancho del riel

  // Calcular zoom visual (1x a 4x)
  const zoomLevel = 1 + (zoom / 0.6) * 3;

  // Calcular posición de la bola (en píxeles desde arriba)
  // zoom 0.6 (4x) = 0px (arriba)
  // zoom 0.3 (2x) = 80px (centro)
  // zoom 0.0 (1x) = 160px (abajo)
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
        bottom: 25, // Bajado 15px más
        width: 60,
        height: 220, // Aumentado para acomodar valor arriba
        opacity,
      }}
    >
      {/* Valor de zoom actual (arriba, siempre visible) */}
      <View
        style={{
          height: 20,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "bold",
            color: "#FFFFFF", // Blanco puro
          }}
        >
          {zoomLevel.toFixed(1)}x
        </Text>
      </View>

      {/* Contenedor principal: Etiquetas + Slider */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 4,
        }}
      >
        {/* ETIQUETAS (izquierda) */}
        <View
          style={{
            height: sliderHeight,
            justifyContent: "space-between",
            alignItems: "center",
            width: 20,
          }}
        >
          {/* Etiqueta 4x (arriba) */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              marginBottom: 2,
            }}
          >
            4x
          </Text>

          {/* Etiqueta 2x (centro exacto) */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
            }}
          >
            2x
          </Text>

          {/* Etiqueta 1x (abajo) */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              marginTop: 2,
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
            width: 20,
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
              borderRadius: 2,
            }}
          />

          {/* Riel vertical (línea pasada) - Blanco 75% */}
          <View
            style={{
              position: "absolute",
              width: sliderWidth,
              height: thumbPosition + 7, // Hasta la bola
              top: 0,
              backgroundColor: "rgba(255, 255, 255, 0.75)", // Blanco 75% opacidad
              borderRadius: 2,
            }}
          />

          {/* Bola (thumb) - Blanca pura */}
          <Animated.View
            style={{
              position: "absolute",
              top: thumbPosition,
              left: (20 - 14) / 2, // Centrar horizontalmente (20 - 14) / 2 = 3
              transform: [{ translateY: -7 }], // Centrar verticalmente (14 / 2 = 7)
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#FFFFFF", // Blanco puro
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 3,
              elevation: 5,
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}
