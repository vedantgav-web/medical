import { useState } from 'react';
import { X, Printer, CheckCircle, MessageCircle, Loader } from 'lucide-react';
import type { Bill, BillItem, Product } from '../../lib/types';
import { useAuth } from '../../lib/auth';

interface ReceiptProps {
  bill: Bill;
  items: (BillItem & { product: Product })[];
  onClose: () => void;
}

export default function Receipt({ bill, items, onClose }: ReceiptProps) {
  const { user } = useAuth();
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [whatsappError, setWhatsappError] = useState('');

  const storeName = user?.store_name || 'MediStore';

  function handlePrint() {
    window.print();
  }

  function buildReceiptText(): string {
    const dateStr = new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    let text = `🧾 *${storeName}*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `Bill #${String(bill.id).padStart(5, '0')}\n`;
    text += `Date: ${dateStr}\n`;
    text += `Customer: ${bill.customer_name}\n`;
    if (bill.customer_phone) text += `Phone: ${bill.customer_phone}\n`;
    text += `Payment: ${bill.payment_method}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `*Items:*\n`;
    for (const item of items) {
      const total = (item.quantity_sold * item.price_per_unit).toFixed(2);
      text += `• ${item.product.name}\n  ${item.quantity_sold} × ₹${item.price_per_unit.toFixed(2)} = ₹${total}\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `*TOTAL: ₹${bill.total_amount.toFixed(2)}*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `Thank you for your purchase! 🙏`;
    return text;
  }

  async function handleSendWhatsApp() {
    if (!bill.customer_phone) {
      setWhatsappError('No customer phone number available');
      return;
    }

    setSendingWhatsapp(true);
    setWhatsappError('');

    try {
      const message = buildReceiptText();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          phone: bill.customer_phone,
          message,
        }),
      });

      const data = await res.json();

      if (data.method === 'link') {
        // Fallback: open WhatsApp Web/App link
        window.open(data.link, '_blank');
        setWhatsappSent(true);
      } else if (data.success) {
        setWhatsappSent(true);
      } else {
        setWhatsappError(data.error || 'Failed to send');
      }
    } catch {
      setWhatsappError('Network error. Try again.');
    } finally {
      setSendingWhatsapp(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm print:bg-white print:p-0 print:fixed print:inset-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden print:shadow-none print:rounded-none print:max-w-none">
        {/* Action Bar (non-print) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 print:hidden">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle size={20} />
            <span className="font-semibold text-sm">Sale Completed!</span>
          </div>
          <div className="flex items-center gap-2">
            {/* WhatsApp Button */}
            {bill.customer_phone && (
              <button
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsapp || whatsappSent}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  whatsappSent
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {sendingWhatsapp ? (
                  <><Loader size={14} className="animate-spin" /> Sending...</>
                ) : whatsappSent ? (
                  <><MessageCircle size={14} /> Sent</>
                ) : (
                  <><MessageCircle size={14} /> WhatsApp</>
                )}
              </button>
            )}
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-900 transition-colors">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* WhatsApp error */}
        {whatsappError && (
          <div className="px-5 py-2 bg-red-50 text-red-600 text-xs print:hidden">
            {whatsappError}
          </div>
        )}

        {/* Receipt Body */}
        <div className="px-6 py-5">
          {/* Store Header */}
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-gray-900 tracking-wide">{storeName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Medical & General Store</p>
            {user?.address && <p className="text-xs text-gray-400 mt-0.5">{user.address}</p>}
            {user?.email && <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>}
            <div className="my-3 border-t border-dashed border-gray-300" />
            <p className="text-xs text-gray-400 font-mono">RECEIPT</p>
          </div>

          {/* Bill Info */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Bill No.</span>
              <span className="font-semibold text-gray-800 font-mono">#{String(bill.id).padStart(5, '0')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Date</span>
              <span className="text-gray-700">{new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Customer</span>
              <span className="text-gray-700 font-medium">{bill.customer_name}</span>
            </div>
            {bill.customer_phone && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Phone</span>
                <span className="text-gray-700">{bill.customer_phone}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Payment</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                bill.payment_method === 'Cash' ? 'bg-green-100 text-green-700' :
                bill.payment_method === 'UPI' ? 'bg-blue-100 text-blue-700' :
                'bg-orange-100 text-orange-700'
              }`}>{bill.payment_method}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-3" />

          {/* Items */}
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {items.map(item => (
              <div key={item.id} className="flex justify-between">
                <div className="flex-1 pr-3">
                  <p className="text-xs font-medium text-gray-800 leading-snug">{item.product.name}</p>
                  <p className="text-xs text-gray-400">{item.quantity_sold} x ₹{item.price_per_unit.toFixed(2)}</p>
                </div>
                <span className="text-xs font-semibold text-gray-800 tabular-nums">
                  ₹{(item.quantity_sold * item.price_per_unit).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 my-3" />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-900">TOTAL</span>
            <span className="text-lg font-bold text-teal-600">₹{bill.total_amount.toFixed(2)}</span>
          </div>

          <div className="border-t border-dashed border-gray-300 mt-4 mb-4" />

          <p className="text-center text-xs text-gray-400">Thank you for your purchase!</p>
        </div>
      </div>
    </div>
  );
}
