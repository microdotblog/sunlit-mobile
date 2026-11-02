import { fetch_nearby_features, search_place_features } from '../api/OpenStreetMap';
import { get_current_location } from './currentLocation';
import { create_place_search_store } from './createPlaceSearchStore';

const PlaceSearch = create_place_search_store({
  get_location: get_current_location,
  fetch_nearby: fetch_nearby_features,
  search_places: search_place_features,
});

export default PlaceSearch;
