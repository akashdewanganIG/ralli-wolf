export function normalizeWhatsAppPhone(phone: string): string | null {
  const raw = phone.trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;

  let digits = raw.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) digits = `91${digits}`;

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return digits;
}

export function whatsappPhoneVariants(canonicalPhone: string): string[] {
  const localIndian = canonicalPhone.startsWith("91")
    ? canonicalPhone.slice(2)
    : null;
  return [
    ...new Set([
      canonicalPhone,
      `+${canonicalPhone}`,
      ...(localIndian?.length === 10
        ? [localIndian, `0${localIndian}`, `+91${localIndian}`]
        : []),
    ]),
  ];
}
