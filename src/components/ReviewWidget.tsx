import React from 'react';
import { Star } from 'lucide-react';

// --- TYPES & INTERFACES ---
interface Review {
  user: string;
  rating: number;
  comment: string;
}

const ReviewWidget: React.FC = () => {
  const reviews: Review[] = [
    { user: "Alice M.", rating: 5, comment: "Amazing trip to Dubai! The guide was perfect." },
    { user: "Kofi B.", rating: 4, comment: "Bus was comfortable but a bit late." },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-white/60 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-800 text-lg">Review Radar</h3>
        <div className="flex items-center gap-1 bg-yellow-100 px-3 py-1 rounded-full">
          <Star size={14} className="fill-yellow-500 text-yellow-500"/>
          <span className="text-xs font-bold text-yellow-700">4.8 Avg</span>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto pr-2">
        {reviews.map((review, i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
             <div className="flex gap-1 mb-2">
               {[...Array(5)].map((_, idx) => (
                 <Star key={idx} size={12} className={idx < review.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}/>
               ))}
             </div>
             <p className="text-sm text-slate-600 italic mb-2">"{review.comment}"</p>
             <p className="text-xs font-bold text-slate-400">- {review.user}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewWidget;