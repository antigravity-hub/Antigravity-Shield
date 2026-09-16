/**
 * Timezone and Locale detection utility for RTL / Regional Features.
 * Determines if the system's timezone belongs to Iran or Arabic-speaking countries.
 */

// IANA Timezone identifiers for Iran and Arab countries
const RTL_TIMEZONES = new Set([
    // Iran
    'Asia/Tehran',
    'Iran',
    // Arabic-speaking countries & territories
    'Asia/Riyadh',     // Saudi Arabia
    'Asia/Dubai',      // UAE
    'Asia/Baghdad',    // Iraq
    'Asia/Kuwait',     // Kuwait
    'Asia/Qatar',      // Qatar
    'Asia/Muscat',     // Oman
    'Asia/Bahrain',    // Bahrain
    'Asia/Amman',      // Jordan
    'Asia/Beirut',     // Lebanon
    'Asia/Damascus',   // Syria
    'Asia/Gaza',       // Palestine
    'Asia/Hebron',     // Palestine
    'Asia/Aden',       // Yemen
    'Africa/Cairo',    // Egypt
    'Africa/Tripoli',  // Libya
    'Africa/Tunis',    // Tunisia
    'Africa/Algiers',  // Algeria
    'Africa/Casablanca', // Morocco
    'Africa/Khartoum', // Sudan
    'Africa/Nouakchott', // Mauritania
    'Africa/Djibouti', // Djibouti
    'Africa/Mogadishu', // Somalia
]);

/**
 * Checks if the given or system timezone is Iran or an Arabic-speaking timezone.
 */
export function isRtlRegionTimezone(timeZone?: string): boolean {
    try {
        const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!tz) return false;

        // Direct match against known IANA names
        if (RTL_TIMEZONES.has(tz)) return true;

        // Windows-specific standard names or partial matches
        const lowerTz = tz.toLowerCase();
        if (
            lowerTz.includes('iran') ||
            lowerTz.includes('tehran') ||
            lowerTz.includes('arabic') ||
            lowerTz.includes('middle east') ||
            lowerTz.includes('arab')
        ) {
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Returns current resolved system timezone name.
 */
export function getSystemTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}
