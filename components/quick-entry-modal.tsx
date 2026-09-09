import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import {
  PARKING_TYPE_LIST,
  type ParkingTypeId,
} from "@/constants/parking-types";

interface QuickEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    licensePlate: string,
    parkingLocation: ParkingTypeId
  ) => Promise<void>;
  isLoading?: boolean;
  initialPlate?: string;
  existingPlates?: string[];
}

export function QuickEntryModal({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
  initialPlate = "",
  existingPlates = [],
}: QuickEntryModalProps) {
  const colors = useColors();

  const [licensePlate, setLicensePlate] = useState("");
  const [parkingLocation, setParkingLocation] =
    useState<ParkingTypeId | null>(null);
  const [plateExists, setPlateExists] = useState(false);

  const plateInputRef = useRef<TextInput>(null);

  const selectableParkingTypes = PARKING_TYPE_LIST.filter(
    (type) => type.selectable
  );

  const isValidLicensePlate = (plate: string): boolean => {
    const plateRegex = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
    return plateRegex.test(plate.trim());
  };

  const checkPlateExists = (plate: string): boolean => {
    if (!plate.trim()) return false;

    const upperPlate = plate.toUpperCase().trim();

    return existingPlates.some(
      (p) => p.toUpperCase() === upperPlate
    );
  };

  React.useEffect(() => {
    if (visible) {
      if (initialPlate) {
        setLicensePlate(initialPlate);
        setPlateExists(checkPlateExists(initialPlate));
      }

      const timer = setTimeout(() => {
        plateInputRef.current?.focus();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [visible, initialPlate, existingPlates]);

  React.useEffect(() => {
    if (!visible) {
      setLicensePlate("");
      setParkingLocation(null);
      setPlateExists(false);
    }
  }, [visible]);

  const handlePlateChange = (text: string) => {
    const upperText = text.toUpperCase();

    setLicensePlate(upperText);

    if (isValidLicensePlate(upperText)) {
      setPlateExists(checkPlateExists(upperText));
    } else {
      setPlateExists(false);
    }
  };

  const handleSubmit = async () => {
    if (!licensePlate.trim()) {
      return;
    }

    if (!isValidLicensePlate(licensePlate)) {
      return;
    }

    if (!parkingLocation) {
      return;
    }

    try {
      await onSubmit(
        licensePlate.toUpperCase().trim(),
        parkingLocation
      );

      setLicensePlate("");
      setParkingLocation(null);
    } catch (error) {
      console.error("Error en handleSubmit:", error);
    }
  };

  const handleClose = () => {
    setLicensePlate("");
    setParkingLocation(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 16,
          }}
          onPress={handleClose}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: colors.foreground,
                marginBottom: 16,
              }}
            >
              Entrada Rápida
            </Text>

            <TextInput
              ref={plateInputRef}
              value={licensePlate}
              onChangeText={handlePlateChange}
              placeholder="Ej: 0000BBB"
              placeholderTextColor={colors.muted}
              editable={!isLoading}
              onFocus={() => {
                if (plateInputRef.current && licensePlate) {
                  plateInputRef.current.setSelection?.(
                    0,
                    licensePlate.length
                  );
                }
              }}
              autoCapitalize="characters"
              className="border border-primary rounded-lg p-3 text-foreground text-center text-lg font-bold mb-4"
              selectionColor={colors.primary}
              selectionHandleColor={colors.primary}
              style={{
                borderWidth: 2,
                borderColor: plateExists
                  ? "#F59E0B"
                  : licensePlate.trim() &&
                    !isValidLicensePlate(licensePlate)
                  ? "#EF4444"
                  : "#0066CC",
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                fontWeight: "bold",
                color: colors.foreground,
                backgroundColor: colors.background,
                textAlign: "center",
                marginBottom: 16,
              }}
            />

            {plateExists && isValidLicensePlate(licensePlate) && (
              <Text
                style={{
                  color: "#F59E0B",
                  fontSize: 12,
                  fontWeight: "500",
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                ⚠️ Esta matrícula ya ha sido registrada
              </Text>
            )}

            <View className="gap-3 mb-4">
              <Text className="text-sm text-muted">
                Ubicación de estacionamiento
              </Text>

              {selectableParkingTypes.map((type) => {
                const selected = parkingLocation === type.id;

                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() =>
                      !isLoading && setParkingLocation(type.id)
                    }
                    className="flex-row items-center gap-3 p-3"
                    disabled={isLoading}
                    style={{
                      opacity: isLoading ? 0.5 : 1,
                    }}
                  >
                    {/* Selector neutro: el color del tipo NO se usa aquí */}
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: selected
                          ? colors.primary
                          : colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selected && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: colors.primary,
                          }}
                        />
                      )}
                    </View>

                    {/* Color del catálogo únicamente como indicador/texto */}
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: type.color,
                      }}
                    />

                    <Text
                      style={{
                        color: type.color,
                        fontWeight: "600",
                        marginRight: 4,
                      }}
                    >
                      {type.code}
                    </Text>

                    <Text className="text-foreground">
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={handleClose}
                disabled={isLoading}
                className="flex-1 p-3 rounded-lg border border-border items-center"
                style={{ opacity: isLoading ? 0.5 : 1 }}
              >
                <Text className="text-foreground font-semibold">
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={
                  isLoading ||
                  !isValidLicensePlate(licensePlate) ||
                  !parkingLocation
                }
                className={`flex-1 p-3 rounded-lg items-center ${
                  isLoading ||
                  !isValidLicensePlate(licensePlate) ||
                  !parkingLocation
                    ? "bg-primary/40 opacity-50"
                    : "bg-primary"
                }`}
              >
                <Text className="text-white font-semibold">
                  {isLoading ? "Guardando..." : "Guardar"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}