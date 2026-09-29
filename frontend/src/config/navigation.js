import {
  IconDashboard,
  IconCreditCard,
  IconBarChart,
  IconLayers,
  IconFileText,
  IconMessageCircle,
  IconDollarSign,
  IconShield,
  IconTrendingUp,
  IconRefreshCw,
  IconExternalLink,
  IconUsers,
  IconSettings,
  IconLock,
} from "../components/Icons";

/**
 * Single source of truth for app navigation (#1580).
 *
 * Both the top bar (Navbar — public pages and mobile) and the admin sidebar
 * (AppLayout — desktop) render from this list, so they can no longer drift.
 * Each `href` must appear exactly once.
 *
 * audience:
 *   'public' — shown to everyone
 *   'admin'  — shown only to authenticated admins (the route itself is guarded
 *              centrally via ADMIN_ROUTES in config/routes.js)
 */
export const NAV_ITEMS = [
  { href: "/pay-fees",                i18nKey: "nav.payFees",     Icon: IconCreditCard,    audience: "public" },
  { href: "/dashboard",               i18nKey: "nav.dashboard",   Icon: IconDashboard,     audience: "admin" },
  { href: "/students",                i18nKey: "nav.students",    Icon: IconUsers,         audience: "admin" },
  { href: "/payments",                i18nKey: "nav.payments",    Icon: IconCreditCard,    audience: "admin" },
  { href: "/reports",                 i18nKey: "nav.reports",     Icon: IconBarChart,      audience: "admin" },
  { href: "/fees",                    i18nKey: "nav.fees",        Icon: IconDollarSign,    audience: "admin" },
  { href: "/fee-adjustments",         i18nKey: "nav.feeRules",    Icon: IconLayers,        audience: "admin" },
  { href: "/analytics",               i18nKey: "nav.analytics",   Icon: IconTrendingUp,    audience: "admin" },
  { href: "/refunds",                 i18nKey: "nav.refunds",     Icon: IconRefreshCw,     audience: "admin" },
  { href: "/disputes",                i18nKey: "nav.disputes",    Icon: IconMessageCircle, audience: "admin" },
  { href: "/webhooks",                i18nKey: "nav.webhooks",    Icon: IconExternalLink,  audience: "admin" },
  { href: "/source-validation-rules", i18nKey: "nav.sourceRules", Icon: IconShield,        audience: "admin" },
  { href: "/settings",                i18nKey: "nav.settings",    Icon: IconSettings,      audience: "admin" },
  { href: "/security",                i18nKey: "nav.security",    Icon: IconLock,          audience: "admin" },
  { href: "/audit-logs",              i18nKey: "nav.auditLogs",   Icon: IconFileText,      audience: "admin" },
];

export const PUBLIC_NAV_ITEMS = NAV_ITEMS.filter((item) => item.audience === "public");
export const ADMIN_NAV_ITEMS = NAV_ITEMS.filter((item) => item.audience === "admin");

/**
 * Items visible to the current viewer, in display order.
 * @param {{ isAdmin: boolean }} opts
 */
export function getNavItems({ isAdmin } = {}) {
  return isAdmin ? NAV_ITEMS : PUBLIC_NAV_ITEMS;
}
