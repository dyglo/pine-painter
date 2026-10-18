import { readFileSync } from "node:fs";
export const replayVersions = {
  vela: JSON.parse(
    readFileSync(new URL("../node_modules/@luxalgo/vela/package.json", import.meta.url), "utf8"),
  ).version as string,
  bridge: JSON.parse(
    readFileSync(
      new URL("../node_modules/@luxalgo/vela-pinets/package.json", import.meta.url),
      "utf8",
    ),
  ).version as string,
  pine: JSON.parse(
    readFileSync(new URL("../node_modules/pinets/package.json", import.meta.url), "utf8"),
  ).version as string,
};
