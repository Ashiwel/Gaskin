import type { Facility, Worker } from '../types';

/**
 * Facilities and health workers used in the demo. Facility names are real
 * public facilities in each region (for local authenticity); all people are fictional.
 * Referral links run PHC/CHPS/dispensary → general hospital → teaching hospital.
 */
export const FACILITIES: Facility[] = [
  // ---- Nigeria ----
  { id: 'f-ng-surulere-phc', name: 'Surulere Primary Health Centre', type: 'phc', country: 'NG', region: 'Lagos', referralFacilityId: 'f-ng-limh' },
  { id: 'f-ng-limh', name: 'Lagos Island Maternity Hospital', type: 'general_hospital', country: 'NG', region: 'Lagos', referralFacilityId: 'f-ng-luth' },
  { id: 'f-ng-luth', name: 'Lagos University Teaching Hospital, Idi-Araba', type: 'teaching_hospital', country: 'NG', region: 'Lagos' },
  { id: 'f-ng-gwale-phc', name: 'Gwale Primary Health Centre', type: 'phc', country: 'NG', region: 'Kano', referralFacilityId: 'f-ng-mmsh' },
  { id: 'f-ng-mmsh', name: 'Murtala Muhammad Specialist Hospital', type: 'general_hospital', country: 'NG', region: 'Kano', referralFacilityId: 'f-ng-akth' },
  { id: 'f-ng-akth', name: 'Aminu Kano Teaching Hospital', type: 'teaching_hospital', country: 'NG', region: 'Kano' },
  { id: 'f-ng-kawo-phc', name: 'Kawo Primary Health Centre', type: 'phc', country: 'NG', region: 'Kaduna', referralFacilityId: 'f-ng-bdth' },
  { id: 'f-ng-bdth', name: 'Barau Dikko Teaching Hospital', type: 'teaching_hospital', country: 'NG', region: 'Kaduna' },
  { id: 'f-ng-idikan-phc', name: 'Idikan Primary Health Centre, Ibadan', type: 'phc', country: 'NG', region: 'Oyo', referralFacilityId: 'f-ng-adeoyo' },
  { id: 'f-ng-adeoyo', name: 'Adeoyo Maternity Teaching Hospital, Ibadan', type: 'general_hospital', country: 'NG', region: 'Oyo' },
  { id: 'f-ng-abakpa-phc', name: 'Abakpa Nike Primary Health Centre', type: 'phc', country: 'NG', region: 'Enugu', referralFacilityId: 'f-ng-esuth' },
  { id: 'f-ng-esuth', name: 'ESUT Teaching Hospital, Parklane', type: 'teaching_hospital', country: 'NG', region: 'Enugu' },
  { id: 'f-ng-yelwa-phc', name: 'Yelwa Primary Health Centre', type: 'phc', country: 'NG', region: 'Bauchi', referralFacilityId: 'f-ng-atbuth' },
  { id: 'f-ng-atbuth', name: 'Abubakar Tafawa Balewa University Teaching Hospital', type: 'teaching_hospital', country: 'NG', region: 'Bauchi' },
  { id: 'f-ng-rumuokoro-phc', name: 'Rumuokoro Primary Health Centre', type: 'phc', country: 'NG', region: 'Rivers', referralFacilityId: 'f-ng-rsuth' },
  { id: 'f-ng-rsuth', name: 'Rivers State University Teaching Hospital', type: 'teaching_hospital', country: 'NG', region: 'Rivers' },
  { id: 'f-ng-oregbeni-phc', name: 'Oregbeni Primary Health Centre, Benin City', type: 'phc', country: 'NG', region: 'Edo', referralFacilityId: 'f-ng-ubth' },
  { id: 'f-ng-ubth', name: 'University of Benin Teaching Hospital', type: 'teaching_hospital', country: 'NG', region: 'Edo' },
  { id: 'f-ng-okpe-phc', name: 'Okpe Road Primary Health Centre, Sapele', type: 'phc', country: 'NG', region: 'Delta', referralFacilityId: 'f-ng-gh-warri' },
  { id: 'f-ng-gh-warri', name: 'Central Hospital Warri', type: 'general_hospital', country: 'NG', region: 'Delta', referralFacilityId: 'f-ng-dsuth' },
  { id: 'f-ng-dsuth', name: 'Delta State University Teaching Hospital, Oghara', type: 'teaching_hospital', country: 'NG', region: 'Delta' },
  { id: 'f-ng-gwange-phc', name: 'Gwange Primary Health Centre, Maiduguri', type: 'phc', country: 'NG', region: 'Borno', referralFacilityId: 'f-ng-umth' },
  { id: 'f-ng-umth', name: 'University of Maiduguri Teaching Hospital', type: 'teaching_hospital', country: 'NG', region: 'Borno' },
  // ---- Kenya ----
  { id: 'f-ke-kowino-disp', name: 'Kowino Dispensary', type: 'dispensary', country: 'KE', region: 'Kisumu', referralFacilityId: 'f-ke-jootrh' },
  { id: 'f-ke-jootrh', name: 'Jaramogi Oginga Odinga Teaching & Referral Hospital', type: 'teaching_hospital', country: 'KE', region: 'Kisumu' },
  { id: 'f-ke-pumwani', name: 'Pumwani Maternity Hospital', type: 'general_hospital', country: 'KE', region: 'Nairobi' },
  { id: 'f-ke-kilifi-crh', name: 'Kilifi County Referral Hospital', type: 'general_hospital', country: 'KE', region: 'Kilifi' },
  { id: 'f-ke-lodwar-crh', name: 'Lodwar County Referral Hospital', type: 'general_hospital', country: 'KE', region: 'Turkana' },
  // ---- Ghana ----
  { id: 'f-gh-kpalsogu-chps', name: 'Kpalsogu CHPS Compound', type: 'chps_compound', country: 'GH', region: 'Northern', referralFacilityId: 'f-gh-tth' },
  { id: 'f-gh-tth', name: 'Tamale Teaching Hospital', type: 'teaching_hospital', country: 'GH', region: 'Northern' },
  { id: 'f-gh-korle-bu', name: 'Korle Bu Teaching Hospital, Maternity Unit', type: 'teaching_hospital', country: 'GH', region: 'Greater Accra' },
  { id: 'f-gh-suntreso', name: 'Suntreso Government Hospital', type: 'general_hospital', country: 'GH', region: 'Ashanti', referralFacilityId: 'f-gh-kath' },
  { id: 'f-gh-kath', name: 'Komfo Anokye Teaching Hospital', type: 'teaching_hospital', country: 'GH', region: 'Ashanti' },
  { id: 'f-gh-sumbrungu-chps', name: 'Sumbrungu CHPS Compound', type: 'chps_compound', country: 'GH', region: 'Upper East', referralFacilityId: 'f-gh-uerh' },
  { id: 'f-gh-uerh', name: 'Upper East Regional Hospital, Bolgatanga', type: 'general_hospital', country: 'GH', region: 'Upper East' },
];

export const WORKERS: Worker[] = [
  // Nigeria
  { id: 'w-ng-bisola', name: 'Bisola Adebayo', role: 'midwife', facilityId: 'f-ng-surulere-phc', country: 'NG', yearsExperience: 12 },
  { id: 'w-ng-kemi', name: 'Kemi Afolabi', role: 'chew', facilityId: 'f-ng-surulere-phc', country: 'NG', yearsExperience: 6 },
  { id: 'w-ng-bankole', name: 'Dr Olufemi Bankole', role: 'obgyn', facilityId: 'f-ng-limh', country: 'NG', yearsExperience: 19, isClinicalReviewer: true },
  { id: 'w-ng-zainab', name: 'Zainab Abdullahi', role: 'chew', facilityId: 'f-ng-gwale-phc', country: 'NG', yearsExperience: 8 },
  { id: 'w-ng-hadiza', name: 'Hadiza Sani', role: 'chips_agent', facilityId: 'f-ng-gwale-phc', country: 'NG', yearsExperience: 3 },
  { id: 'w-ng-rebecca', name: 'Rebecca Yakubu', role: 'midwife', facilityId: 'f-ng-kawo-phc', country: 'NG', yearsExperience: 10 },
  { id: 'w-ng-folasade', name: 'Folasade Ogunleye', role: 'midwife', facilityId: 'f-ng-idikan-phc', country: 'NG', yearsExperience: 15 },
  { id: 'w-ng-chioma', name: 'Chioma Nwosu', role: 'nurse', facilityId: 'f-ng-abakpa-phc', country: 'NG', yearsExperience: 7 },
  { id: 'w-ng-lami', name: 'Lami Bello', role: 'jchew', facilityId: 'f-ng-yelwa-phc', country: 'NG', yearsExperience: 4 },
  { id: 'w-ng-osaze', name: 'Osayuki Igbinedion', role: 'midwife', facilityId: 'f-ng-oregbeni-phc', country: 'NG', yearsExperience: 11 },
  { id: 'w-ng-ejiro', name: 'Ejiro Oghenekaro', role: 'chew', facilityId: 'f-ng-okpe-phc', country: 'NG', yearsExperience: 7 },
  { id: 'w-ng-fatimakb', name: 'Fatima Kyari', role: 'midwife', facilityId: 'f-ng-gwange-phc', country: 'NG', yearsExperience: 9 },
  { id: 'w-ng-blessing', name: 'Blessing Amadi', role: 'midwife', facilityId: 'f-ng-rumuokoro-phc', country: 'NG', yearsExperience: 9 },
  // Kenya
  { id: 'w-ke-rose', name: 'Rose Achieng Otieno', role: 'chp', facilityId: 'f-ke-kowino-disp', country: 'KE', yearsExperience: 6 },
  { id: 'w-ke-wanjiru', name: 'Wanjiru Kamau', role: 'nurse', facilityId: 'f-ke-pumwani', country: 'KE', yearsExperience: 11 },
  { id: 'w-ke-kadzo', name: 'Kadzo Chengo', role: 'chp', facilityId: 'f-ke-kilifi-crh', country: 'KE', yearsExperience: 5 },
  { id: 'w-ke-ekai', name: 'Ekai Lomuria', role: 'chp', facilityId: 'f-ke-lodwar-crh', country: 'KE', yearsExperience: 4 },
  // Ghana
  { id: 'w-gh-mariama', name: 'Mariama Alhassan', role: 'cho', facilityId: 'f-gh-kpalsogu-chps', country: 'GH', yearsExperience: 7 },
  { id: 'w-gh-efua', name: 'Efua Mensah', role: 'midwife', facilityId: 'f-gh-korle-bu', country: 'GH', yearsExperience: 13 },
  { id: 'w-gh-akosua', name: 'Akosua Boateng', role: 'midwife', facilityId: 'f-gh-suntreso', country: 'GH', yearsExperience: 9 },
  { id: 'w-gh-asibi', name: 'Asibi Ayamga', role: 'cho', facilityId: 'f-gh-sumbrungu-chps', country: 'GH', yearsExperience: 5 },
];

export function facilityById(id: string | undefined): Facility | undefined {
  return id ? FACILITIES.find((f) => f.id === id) : undefined;
}

export function workerById(id: string | undefined): Worker | undefined {
  return id ? WORKERS.find((w) => w.id === id) : undefined;
}
