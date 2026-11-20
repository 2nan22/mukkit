import proj4 from "proj4";

// 카카오 즐겨찾기 x · y 는 중부원점 TM(EPSG:5181) 값에 2.5 를 곱한 것 (WCONGNAMUL)
const EPSG_5181 = "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs";
const WCONG_SCALE = 2.5;

export function wcongToLatLng(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4(EPSG_5181, "WGS84", [x / WCONG_SCALE, y / WCONG_SCALE]);
  return { lat, lng };
}
