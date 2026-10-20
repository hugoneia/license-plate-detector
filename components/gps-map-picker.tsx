import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface GPSMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onCoordinatesChange: (latitude: number, longitude: number) => void;
}

export function GPSMapPicker({
  latitude,
  longitude,
  onCoordinatesChange,
}: GPSMapPickerProps) {
  const hasInitialLocation =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  const initialLatitude = hasInitialLocation ? latitude : null;
  const initialLongitude = hasInitialLocation ? longitude : null;

  const html = useMemo(() => {
    const lat = JSON.stringify(initialLatitude);
    const lng = JSON.stringify(initialLongitude);

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    body { font-family: sans-serif; }
    .leaflet-control-attribution { font-size: 9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var hasInitialLocation = ${lat} !== null && ${lng} !== null;
      var start = hasInitialLocation ? [${lat}, ${lng}] : [0, 0];
      var map = L.map('map', {
        center: start,
        zoom: hasInitialLocation ? 19 : 2,
        maxZoom: 19,
        zoomControl: true
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics'
        }
      ).addTo(map);

      function sendCoordinates(point) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          latitude: point.lat,
          longitude: point.lng
        }));
      }

      var marker = hasInitialLocation
        ? L.marker(start, { draggable: true }).addTo(map)
        : null;

      function attachMarkerEvents(target) {
        target.on('dragend', function () {
          sendCoordinates(target.getLatLng());
        });
      }

      if (marker) attachMarkerEvents(marker);

      map.on('click', function (event) {
        if (!marker) {
          marker = L.marker(event.latlng, { draggable: true }).addTo(map);
          attachMarkerEvents(marker);
        } else {
          marker.setLatLng(event.latlng);
        }
        sendCoordinates(event.latlng);
      });

      setTimeout(function () { map.invalidateSize(); }, 250);
    })();
  </script>
</body>
</html>`;
  }, [initialLatitude, initialLongitude]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const point = JSON.parse(event.nativeEvent.data);
      const lat = Number(point.latitude);
      const lng = Number(point.longitude);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        onCoordinatesChange(lat, lng);
      }
    } catch {
      // Ignorar mensajes que no contengan coordenadas válidas.
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Toca el punto correcto en el mapa o arrastra el marcador.
      </Text>
      <View style={styles.map}>
        <WebView
          source={{ html }}
          onMessage={handleMessage}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webView}
          nestedScrollEnabled
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  hint: {
    fontSize: 12,
    color: "#777777",
  },
  map: {
    height: 300,
    overflow: "hidden",
    borderRadius: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: "#eeeeee",
  },
});
