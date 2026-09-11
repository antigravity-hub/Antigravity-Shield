/**
 * Centralized Layout Constants & Styling Tokens
 *
 * Defines the responsive grid, viewport boundaries, and max-widths across all views.
 * Changing values here updates all platform pages uniformly.
 */

/**
 * Global responsive max-width class for widescreen monitors.
 * Replaces hardcoded classes across all top-level platform views.
 */
export const CONTAINER_MAX_WIDTH = 'max-w-[1720px] 2xl:max-w-[1850px] w-full mx-auto';

/**
 * Standard page content container wrapper classes.
 */
export const PAGE_CONTAINER_CLASS = `p-5 space-y-4 ${CONTAINER_MAX_WIDTH}`;

/**
 * Table column widths configuration for the Accounts view.
 */
export const ACCOUNT_TABLE_COLUMNS = {
    email: 'min-w-[200px] w-[260px]',
    models: 'min-w-[360px] xl:min-w-[420px] 2xl:min-w-[480px]',
    five_hour: 'w-[95px] min-w-[90px]',
    weekly: 'w-[100px] min-w-[95px]',
    last_used: 'w-[85px] min-w-[80px]',
    actions: 'w-[165px] min-w-[165px]',
} as const;
