import React, { useState, useRef, useEffect } from 'react';
import { Compass, X, ArrowRight, Send, Sparkles } from 'lucide-react';

export interface TalkToHawkBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToPortal: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'hawk' | 'user';
  text: string;
  time: string;
}

const KNOWLEDGE_BASE: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ['document', 'requirement', 'papers', 'need', 'upload', 'certificate'],
    answer:
      'Required documents for admission include: 1) Student Government 17-digit Birth Registration Certificate (BRN), 2) Parents/Guardian National ID (NID) or Passport, 3) Recent passport-sized color photograph, 4) Previous school academic report card/transcript, and 5) Medical/Immunization record.',
  },
  {
    keywords: ['hold', 'lock', 'atomic', '10 minute', 'minutes', 'seat', 'reserve'],
    answer:
      'Our seat booking system uses a 10-Minute Atomic Hold Lock. Once you click "Lock Seat", that specific seat is reserved exclusively for your child for 10 minutes with zero lottery or quota bias. You have 10 minutes to complete the tuition payment to finalize confirmed admission.',
  },
  {
    keywords: ['sibling', 'brother', 'sister', 'discount', 'concession', 'waiver'],
    answer:
      'Yes! Onnorokom School, Bangladesh offers an automated 10% Sibling Fee Concession on admission and tuition fees for the second and subsequent children enrolled under the same verified family account.',
  },
  {
    keywords: ['shift', 'time', 'timing', 'hour', 'morning', 'day', 'schedule', 'routine'],
    answer:
      'We operate in two shifts: Morning Shift runs from 07:30 AM to 12:00 PM BST (Sunday to Thursday). Day Shift runs from 12:30 PM to 05:00 PM BST. Class routines follow an international curriculum with dedicated STEAM and athletics periods.',
  },
  {
    keywords: ['fee', 'cost', 'tuition', 'pay', 'payment', 'bkash', 'nagad', 'card'],
    answer:
      'Tuition fees range from ৳15,000 to ৳35,000 depending on the division (Early Years, Primary, Secondary). You can pay fees securely online via bKash, Nagad, Visa, Mastercard, or City Bank Direct Transfer with instant automated receipt generation.',
  },
  {
    keywords: ['birth', 'registration', 'brn', '17', 'digit', 'number', 'primary key'],
    answer:
      'The government 17-digit Birth Registration Number is our mandatory primary key. It uniquely identifies every candidate child, prevents duplicate applications, and enforces the Single Admission Rule.',
  },
  {
    keywords: ['curriculum', 'ib', 'cambridge', 'nctb', 'standard', 'board'],
    answer:
      'Onnorokom School is an authorized IB World School and Cambridge International school in Tejgaon, complemented by National Curriculum benchmarks. We emphasize scientific inquiry, bilingual fluency in English & Bangla, robotics, and innovation labs.',
  },
];

export const TalkToHawkBotModal: React.FC<TalkToHawkBotModalProps> = ({
  isOpen,
  onClose,
  onProceedToPortal,
}) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'hawk',
      text: "Hello! I'm Hawk, your Onnorokom School, Bangladesh admissions counselor. How can I assist your family today with admissions, seat availability, or enrollment requirements?",
      time: 'Just now',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const lower = query.toLowerCase();
      let replyText =
        "Thank you for asking! For detailed admission procedures and seat reservations, please proceed to the Parent Portal. You can also contact our Admissions Helpline at +880 2 843 1101 or email admissions@onnorokomschool.edu.bd.";

      for (const item of KNOWLEDGE_BASE) {
        if (item.keywords.some((k) => lower.includes(k))) {
          replyText = item.answer;
          break;
        }
      }

      const hawkMsg: ChatMessage = {
        id: `hawk-${Date.now()}`,
        sender: 'hawk',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, hawkMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        data-testid="talk-to-hawk-modal"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#004d3d] text-amber-300 flex items-center justify-center shrink-0">
              <Compass size={20} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-slate-900 text-lg leading-tight">
                Talk to Hawk Admissions Desk
              </h3>
              <p className="text-xs font-semibold text-emerald-800 tracking-wide">
                Onnorokom School, Bangladesh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none"
            aria-label="Close Hawk Helpdesk"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Frequently Asked Questions Green Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-4">
            <h4 className="font-bold text-xs sm:text-sm text-emerald-950 mb-2">
              Frequently Asked Questions
            </h4>
            <ul className="space-y-1.5 text-xs text-emerald-900 leading-relaxed">
              <li>
                • <strong>Primary Key:</strong> Mandatory 17-digit Birth Registration Number.
              </li>
              <li>
                • <strong>No Quotas/Lottery:</strong> Admissions are strictly First-Come-First-Served upon payment.
              </li>
              <li>
                • <strong>Class Shifts:</strong> Morning (07:30 - 12:00 BST) & Day (12:30 - 05:00 BST).
              </li>
            </ul>
          </div>

          {/* Quick FAQ Question Chips */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-600" />
              <span>Suggested Inquiries</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Required Documents',
                '10-Min Hold Lock',
                'Sibling Concession',
                'Morning & Day Shifts',
                'Tuition Fees',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendMessage(chip)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-50 hover:bg-emerald-50 hover:text-emerald-900 text-slate-700 border border-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:outline-none"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation History */}
          <div className="space-y-3 pt-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'hawk' && (
                  <div className="w-7 h-7 rounded-md bg-[#004d3d] text-amber-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <Compass size={14} />
                  </div>
                )}
                <div
                  className={`rounded-lg px-3.5 py-2.5 text-xs max-w-[85%] leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#014d33] text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60'
                  }`}
                >
                  <p>{m.text}</p>
                  <span
                    className={`block text-[9px] mt-1 ${
                      m.sender === 'user' ? 'text-emerald-200' : 'text-slate-400'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2.5 items-center text-xs text-slate-500">
                <div className="w-7 h-7 rounded-full bg-[#014d33] text-amber-300 flex items-center justify-center text-xs shrink-0">
                  <Compass size={14} />
                </div>
                <div className="bg-slate-100 rounded-xl px-3 py-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs sm:text-sm font-extrabold text-slate-800 block">
              How can our admissions counselor help you today?
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask any question regarding seat availability, documents, or curriculum..."
                className="w-full p-3 pr-10 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#014d33]/20 focus:border-[#014d33] resize-none transition bg-white"
              />
              <button
                type="button"
                disabled={!inputText.trim()}
                onClick={() => handleSendMessage()}
                className="absolute right-2.5 bottom-3.5 p-1.5 rounded-lg bg-[#014d33] text-white hover:bg-emerald-800 disabled:opacity-40 transition"
                title="Send Message"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onProceedToPortal();
            }}
            className="px-5 py-2 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
          >
            <span>Proceed to Parent Portal</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
