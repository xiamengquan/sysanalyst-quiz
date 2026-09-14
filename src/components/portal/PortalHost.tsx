"use client";

/** Portal 通道挂载点：布局层放置一次，供 Modal/Drawer/Overlay 投射 */
export const PORTAL_CHANNEL_ID = "app-portal-channel";

export function PortalHost() {
  return <div id={PORTAL_CHANNEL_ID} className="portal-channel" />;
}
