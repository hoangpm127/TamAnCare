export const CUSTOMER_AUDIENCE_HEADER = "x-taman-audience";
export const CUSTOMER_AUDIENCE_VALUE = "customer";

export const customerAudienceHeaders = {
  [CUSTOMER_AUDIENCE_HEADER]: CUSTOMER_AUDIENCE_VALUE,
} as const;

export function isCustomerAudienceRequest(request: Request) {
  return request.headers.get(CUSTOMER_AUDIENCE_HEADER)?.toLowerCase() === CUSTOMER_AUDIENCE_VALUE;
}
