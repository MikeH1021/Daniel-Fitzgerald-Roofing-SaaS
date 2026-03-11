export interface PlacePredictionResult {
  text: string;
  placeId: string;
  mainText: string;
  raw: any; // raw suggestion object for toPlace()
}

export interface SelectedPlace {
  formattedAddress: string;
  lat: number;
  lng: number;
}
