import packageJson from "../../package.json";

/** 站点版本号（与 package.json / release-notes.latest 对齐） */
export const SITE_VERSION = packageJson.version as string;
