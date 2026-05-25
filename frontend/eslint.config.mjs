import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const generatedIgnores = [
  {
    ignores: ["android/app/build/**", "android/app/src/main/assets/**"],
  },
];

const config = [...generatedIgnores, ...nextVitals, ...nextTypescript];

export default config;
