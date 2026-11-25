/** Local catalog: no production data or hosted service. */
export default {
  stories: ["../catalog/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  typescript: { reactDocgen: "react-docgen" },
  async viteFinal(config) {
    return {
      ...config,
      base: "./",
      server: { ...config.server, host: "127.0.0.1" },
      build: { ...config.build, chunkSizeWarningLimit: 1000 },
    };
  },
};
