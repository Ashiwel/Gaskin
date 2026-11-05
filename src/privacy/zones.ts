import type { CountryCode } from '../types';

/**
 * Coarse zones used instead of a state, county or region, so the AI can
 * suggest local foods or language without learning where she lives.
 */
const NG: Record<string, string> = {};
const add = (zone: string, names: string[], into: Record<string, string>) => names.forEach((n) => (into[n.toLowerCase()] = zone));
add('North Central Nigeria', ['Benue', 'Kogi', 'Kwara', 'Nasarawa', 'Niger', 'Plateau', 'FCT', 'Abuja', 'Federal Capital Territory'], NG);
add('North East Nigeria', ['Adamawa', 'Bauchi', 'Borno', 'Gombe', 'Taraba', 'Yobe'], NG);
add('North West Nigeria', ['Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Sokoto', 'Zamfara'], NG);
add('South East Nigeria', ['Abia', 'Anambra', 'Ebonyi', 'Enugu', 'Imo'], NG);
add('South South Nigeria', ['Akwa Ibom', 'Bayelsa', 'Cross River', 'Delta', 'Edo', 'Rivers'], NG);
add('South West Nigeria', ['Ekiti', 'Lagos', 'Ogun', 'Ondo', 'Osun', 'Oyo'], NG);

const KE: Record<string, string> = {};
add('Coast, Kenya', ['Mombasa', 'Kilifi', 'Kwale', 'Lamu', 'Tana River', 'Taita Taveta'], KE);
add('Nairobi, Kenya', ['Nairobi'], KE);
add('Central Kenya', ['Kiambu', 'Nyeri', "Murang'a", 'Muranga', 'Kirinyaga', 'Nyandarua'], KE);
add('Rift Valley, Kenya', ['Nakuru', 'Uasin Gishu', 'Kericho', 'Bomet', 'Narok', 'Kajiado', 'Turkana', 'West Pokot', 'Samburu', 'Trans Nzoia', 'Elgeyo Marakwet', 'Nandi', 'Baringo', 'Laikipia'], KE);
add('Western Kenya', ['Kakamega', 'Bungoma', 'Busia', 'Vihiga'], KE);
add('Nyanza, Kenya', ['Kisumu', 'Siaya', 'Homa Bay', 'Migori', 'Kisii', 'Nyamira'], KE);
add('Eastern Kenya', ['Machakos', 'Kitui', 'Makueni', 'Meru', 'Embu', 'Isiolo', 'Marsabit', 'Tharaka Nithi'], KE);
add('North Eastern Kenya', ['Garissa', 'Wajir', 'Mandera'], KE);

const GH: Record<string, string> = {};
add('Northern Ghana', ['Northern', 'Upper East', 'Upper West', 'Savannah', 'North East'], GH);
add('Middle Ghana', ['Ashanti', 'Bono', 'Bono East', 'Ahafo', 'Oti'], GH);
add('Southern Ghana', ['Greater Accra', 'Accra', 'Central', 'Western', 'Western North', 'Volta', 'Eastern'], GH);

const BY_COUNTRY: Record<CountryCode, Record<string, string>> = { NG, KE, GH };

export const COUNTRY_NAMES: Record<CountryCode, string> = { NG: 'Nigeria', KE: 'Kenya', GH: 'Ghana' };

/** Zone for a region name, or undefined if unknown (then only the country is shared) */
export function zoneFor(country: CountryCode, region: string | undefined): string | undefined {
  if (!region) return undefined;
  const key = region.replace(/\s+(State|County|Region)$/i, '').trim().toLowerCase();
  return BY_COUNTRY[country]?.[key];
}
