declare module '@react-google-maps/api' {
  const GoogleMap: any;
  const MarkerF: any;
  function useJsApiLoader(options: { googleMapsApiKey: string; libraries: ['places'] }): { isLoaded: boolean };
  export { GoogleMap, MarkerF, useJsApiLoader };
}
