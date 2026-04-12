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
 * Slider de zoom vertical - Diseño compacto y posición baja con ajustes finos
 * - Posición: Zona inferior derecha (right: 15, bottom: 30)
 * - Altura total: 120px (compacto)
 * - Estructura: Valor + Etiquetas comprimidas (4x, 2x, 1x) + slider vertical
 * - Dirección: Arriba = zoom IN (4x), Abajo = zoom OUT (1x)
 * - Bola: 15x15px (50% más grande), opacidad 0.6 en reposo, 1.0 al tocar
 * - Relleno: Blanco sólido desde 1x hasta bola, translúcido desde bola hasta 4x
 * - Etiquetas: Blancas translúcidas (0.6)
 * - Valor zoom: Opacidad 0.6 en reposo, 1.0 al tocar
 * - Rango: 0.0 (1x) a 0.6 (4x), default 0.2 (2x)
 */
export function ZoomSlider({ zoom, onZoomChange, onZoomResetTimer }: ZoomSliderProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const [opacitySlider] = useState(new Animated.Value(0.2)); // Opacidad del slider
  const [opacityValue] = useState(new Animated.Value(0.6)); // Opacidad del valor de zoom
  const [thumbOpacity] = useState(new Animated.Value(0.7)); // Opacidad de la bola (0.7 reposo, 1.0 activa)
  const opacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const sliderHeight = 100; // Altura del riel
  const sliderWidth = 3; // Ancho del riel
  const thumbSize = 15; // Bola 50% más grande (15x15px)

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
        Animated.timing(opacitySlider, {
          toValue: 1.0,
          duration: 100,
          useNativeDriver: false,
        }).start();
        // Mostrar valor (opacidad 1.0)
        Animated.timing(opacityValue, {
          toValue: 1.0,
          duration: 100,
          useNativeDriver: false,
        }).start();
        // Mostrar bola (opacidad 1.0)
        Animated.timing(thumbOpacity, {
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
        // Volver a opacidad baja (0.2 slider, 0.6 valor, 0.6 bola) tras 1 segundo
        opacityTimer.current = setTimeout(() => {
          Animated.timing(opacitySlider, {
            toValue: 0.2,
            duration: 300,
            useNativeDriver: false,
          }).start();
          Animated.timing(opacityValue, {
            toValue: 0.6,
            duration: 300,
            useNativeDriver: false,
          }).start();
          Animated.timing(thumbOpacity, {
            toValue: 0.7,
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
        opacity: opacitySlider,
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
        {/* ETIQUETAS (izquierda) - Posicionamiento manual */}
        <View
          style={{
            height: sliderHeight,
            alignItems: "center",
            width: 16,
            position: "relative",
          }}
        >
          {/* Etiqueta 4x (arriba, posición 0) */}
          <Text
            style={{
              position: "absolute",
              top: 0,
              fontSize: 8,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              opacity: 0.6, // Translúcida
              lineHeight: 10,
            }}
          >
            4x
          </Text>

          {/* Etiqueta 2x (centro exacto) - Alineada con posición default de bola (zoom 0.2) */}
          {/* thumbPosition = (1 - 0.2 / 0.6) * 100 = (1 - 0.333) * 100 = 66.7px */}
          {/* Centrar texto: top = 66.7 - (lineHeight / 2) = 66.7 - 5 = 61.7px */}
          <Text
            style={{
              position: "absolute",
              top: 62,
              fontSize: 8,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              opacity: 0.6, // Translúcida
              lineHeight: 10,
            }}
          >
            2x
          </Text>

          {/* Etiqueta 1x (abajo, posición 100px) */}
          <Text
            style={{
              position: "absolute",
              bottom: 0,
              fontSize: 8,
              fontWeight: "700",
              color: "#FFFFFF", // Blanco puro
              opacity: 0.6, // Translúcida
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
          {/* Riel vertical (línea de fondo) - Translúcido */}
          <View
            style={{
              position: "absolute",
              width: sliderWidth,
              height: sliderHeight,
              backgroundColor: "rgba(255, 255, 255, 0.3)", // Blanco 30% opacidad (translúcido)
              borderRadius: 1.5,
            }}
          />

          {/* Riel vertical (línea rellena) - Blanco sólido DESDE 1x HASTA bola */}
          <View
            style={{
              position: "absolute",
              width: sliderWidth,
              height: sliderHeight - thumbPosition, // Desde bola hacia abajo (1x)
              bottom: 0,
              backgroundColor: "#FFFFFF", // Blanco puro sólido
              borderRadius: 1.5,
            }}
          />

          {/* Bola (thumb) - 50% más grande, opacidad dinámica */}
          <Animated.View
            style={{
              position: "absolute",
              top: thumbPosition,
              left: (18 - thumbSize) / 2, // Centrar horizontalmente
              transform: [{ translateY: -thumbSize / 2 }], // Centrar verticalmente
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: "#FFFFFF", // Blanco puro
              opacity: thumbOpacity, // Opacidad dinámica (0.6 en reposo, 1.0 al tocar)
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.25,
              shadowRadius: 2,
              elevation: 3,
            }}
          />
        </View>
      </View>

      {/* Valor de zoom actual (arriba, en la esquina) - Opacidad dinámica */}
      <Animated.View
        style={{
          position: "absolute",
          top: -16,
          right: 0,
          width: 30,
          height: 14,
          justifyContent: "center",
          alignItems: "center",
          opacity: opacityValue, // Opacidad dinámica (0.6 en reposo, 1.0 al tocar)
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
      </Animated.View>
    </Animated.View>
  );
}
