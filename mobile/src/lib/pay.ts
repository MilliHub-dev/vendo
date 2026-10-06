import * as WebBrowser from 'expo-web-browser';

/**
 * Opens the Paystack payment page inside the app and resolves when the customer closes it.
 * Closing the page doesn't mean they paid — always confirm with the server afterwards.
 */
export async function openPaymentPage(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, dismissButtonStyle: 'done' }).catch(() => {});
}
