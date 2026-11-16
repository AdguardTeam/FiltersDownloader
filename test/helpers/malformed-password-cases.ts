/**
 * Passwords with characters that the generic redaction does not accept.
 */
export const MALFORMED_PASSWORD_CASES = [
    {
        name: 'a double quote in the password',
        password: 'pa"ss-secret',
        leaked: 'pa"ss-secret',
    },
    {
        name: 'an angle bracket in the password',
        password: 'pa<ss-secret',
        leaked: 'pa<ss-secret',
    },
    {
        name: 'a single quote in the password',
        password: "pa'ss-secret",
        leaked: "pa'ss-secret",
    },
    {
        name: 'a leading space in the password',
        password: ' pass-secret',
        leaked: 'pass-secret',
    },
];
