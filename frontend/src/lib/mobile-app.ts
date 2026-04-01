const MOBILE_APP_BUILD_FLAG = process.env.NEXT_PUBLIC_MOBILE_APP === "true";

export function isMobileAppBuild(): boolean {
  return MOBILE_APP_BUILD_FLAG;
}
