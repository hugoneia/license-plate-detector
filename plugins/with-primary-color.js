const { withAndroidStyles } = require("@expo/config-plugins");

module.exports = function withPrimaryColor(config) {
  return withAndroidStyles(config, (config) => {
    const appTheme = config.modResults.resources.style.find(
      (style) => style.$.name === "AppTheme"
    );

    if (!appTheme) {
      throw new Error("with-primary-color: no se encontró el estilo AppTheme");
    }

    appTheme.item = appTheme.item || [];
    const accent = appTheme.item.find(
      (item) => item.$ && item.$.name === "colorAccent"
    );

    if (accent) {
      accent._ = "#023c69";
    } else {
      appTheme.item.push({
        $: { name: "colorAccent" },
        _: "#023c69",
      });
    }

    return config;
  });
};
