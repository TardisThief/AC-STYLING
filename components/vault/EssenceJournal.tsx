"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookHeart, Sparkles, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { saveEssenceResponse } from "@/app/actions/essence-lab";

type Question = {
    key: string;
    label: string;
    placeholder: string;
    value: string;
    updated_at: string | null;
};

type ChapterData = {
    chapterId: string;
    chapterTitle: string;
    chapterSlug: string;
    questions: Question[];
};

type MasterclassGroup = {
    masterclassId: string;
    masterclassTitle: string;
    chapters: ChapterData[];
};

interface EssenceJournalProps {
    data: MasterclassGroup[] | null;
    allMasterclasses?: { id: string; title: string }[];
}

function JournalQuestionRow({ 
    question, 
    chapterId, 
    chapterSlug, 
    masterclassId 
}: { 
    question: Question, 
    chapterId: string, 
    chapterSlug: string, 
    masterclassId: string 
}) {
    const [val, setVal] = useState(question.value || '');
    const [status, setStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [val]);

    const handleBlur = async () => {
        if (val === question.value && status === 'idle') return; // Didn't change
        setStatus('saving');
        const res = await saveEssenceResponse(
            masterclassId === 'standalone' ? null : masterclassId, 
            chapterId, 
            chapterSlug, 
            question.key, 
            val
        );
        if (res.success) {
            setStatus('saved');
            question.value = val;
        } else {
            setStatus('error');
        }
    };

    const isFilled = val.trim().length > 0;

    return (
        <div className="bg-white/60 p-4 rounded-sm border border-ac-taupe/5 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="absolute top-0 left-0 w-0.5 h-full bg-ac-gold/50 group-hover:bg-ac-gold transition-colors" />

            <div className="flex justify-between items-baseline mb-2 mx-1">
                <label htmlFor={question.key} className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest flex-grow">
                    {question.label}
                </label>
                {status === 'saving' ? (
                    <Loader2 size={14} className="text-ac-gold animate-spin" />
                ) : status === 'error' ? (
                    <span className="text-[10px] text-red-500">Error saving</span>
                ) : isFilled ? (
                    <CheckCircle2 size={16} className="text-ac-olive translate-y-2" strokeWidth={2.5} />
                ) : null}
            </div>

            <textarea
                ref={textareaRef}
                id={question.key}
                value={val}
                onChange={(e) => {
                    setVal(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                }}
                onBlur={handleBlur}
                placeholder={question.placeholder || 'Your insights...'}
                rows={1}
                className="w-full bg-white/40 border border-white/50 rounded-sm p-3 text-sm text-ac-taupe placeholder:text-ac-taupe/40 focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold transition-colors resize-none font-serif overflow-hidden leading-relaxed"
            />
        </div>
    );
}

export default function EssenceJournal({ data, allMasterclasses }: EssenceJournalProps) {
    const [filterMc, setFilterMc] = useState<string>('ALL');
    const [filterIncomplete, setFilterIncomplete] = useState<boolean>(false);
    
    const [openSections, setOpenSections] = useState<string[]>(
        data ? data.map(mc => mc.masterclassId) : []
    );
    
    // Chapters collapsed by default
    const [openChapters, setOpenChapters] = useState<string[]>([]);

    const toggleSection = (id: string) => {
        setOpenSections(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const toggleChapter = (id: string) => {
        setOpenChapters(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white/40 backdrop-blur-md rounded-sm border border-ac-taupe/10 min-h-[400px]">
                <Sparkles size={48} className="text-ac-gold mb-4 opacity-50" />
                <h3 className="font-serif text-2xl text-ac-taupe mb-2">Your Journal is Empty</h3>
                <p className="text-ac-taupe/60 max-w-md">
                    Complete your first Masterclass module to unlock your interactive journal.
                </p>
            </div>
        );
    }

    // Apply filtering
    const filteredData = data.map(mc => {
        if (filterMc !== 'ALL' && mc.masterclassId !== filterMc) return null;

        const filteredChapters = mc.chapters.map(ch => {
            const filteredQuestions = ch.questions.filter(q => {
                if (filterIncomplete && (q.value || '').trim().length > 0) return false;
                return true;
            });
            if (filteredQuestions.length === 0) return null;
            return { ...ch, questions: filteredQuestions };
        }).filter((x): x is NonNullable<typeof x> => x !== null);

        if (filteredChapters.length === 0) return null;
        return { ...mc, chapters: filteredChapters };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/40 p-4 border border-ac-taupe/10 rounded-sm mb-6">
                <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ac-taupe/60">
                        Filter by Masterclass:
                    </label>
                    <select
                        value={filterMc}
                        onChange={(e) => setFilterMc(e.target.value)}
                        className="text-xs border border-ac-taupe/20 rounded p-1.5 focus:outline-none focus:border-ac-gold bg-white text-ac-taupe"
                    >
                        <option value="ALL">All Masterclasses</option>
                        {(allMasterclasses && allMasterclasses.length > 0 ? allMasterclasses : data.map(mc => ({ id: mc.masterclassId, title: mc.masterclassTitle }))).map(mc => {
                            const hasEntries = data.some(d => d.masterclassId === mc.id);
                            return (
                                <option key={mc.id} value={mc.id}>
                                    {mc.title}{!hasEntries ? ' (not started)' : ''}
                                </option>
                            );
                        })}
                    </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                        type="checkbox"
                        checked={filterIncomplete}
                        onChange={(e) => setFilterIncomplete(e.target.checked)}
                        className="w-4 h-4 rounded border-ac-taupe/20 text-ac-gold focus:ring-ac-gold accent-ac-gold"
                    />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-ac-taupe/60 group-hover:text-ac-taupe transition-colors">
                        Show Missing Answers Only
                    </span>
                </label>
            </div>

            {filteredData.length === 0 && (
                <div className="text-center py-12 text-ac-taupe/60">
                    No answers match your required filters.
                </div>
            )}

            {filteredData.map((mc) => {
                const isOpen = openSections.includes(mc.masterclassId);
                let totalQs = 0;
                let answQs = 0;
                
                // Calculate completion for header using raw data (unfiltered)
                const rawMc = data.find(d => d.masterclassId === mc.masterclassId);
                rawMc?.chapters.forEach(ch => {
                    ch.questions.forEach(q => {
                        totalQs++;
                        if ((q.value || '').trim().length > 0) answQs++;
                    });
                });

                return (
                    <motion.div
                        key={mc.masterclassId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/40 backdrop-blur-sm border border-ac-taupe/10 rounded-sm overflow-hidden"
                    >
                        {/* Header / Toggler */}
                        <button
                            onClick={() => toggleSection(mc.masterclassId)}
                            className="w-full flex flex-col md:flex-row md:items-center justify-between p-6 bg-white/40 hover:bg-white/60 transition-colors text-left gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <BookHeart size={20} className="text-ac-gold flex-shrink-0" />
                                <div>
                                    <h2 className="font-serif text-2xl text-ac-taupe leading-tight">{mc.masterclassTitle}</h2>
                                    <p className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold mt-1">
                                        {answQs} of {totalQs} Answered
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-self-end">
                                {isOpen ? <ChevronDown size={20} className="text-ac-taupe/60" /> : <ChevronRight size={20} className="text-ac-taupe/60" />}
                            </div>
                        </button>

                        {/* Collapsible Content */}
                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="p-6 pt-0 border-t border-ac-taupe/5 space-y-8">
                                        <div className="h-2" />
                                        {mc.chapters.map((ch) => {
                                            const isChapterOpen = openChapters.includes(ch.chapterId);
                                            const allAnswered = ch.questions.length > 0 && ch.questions.every((q) => (q.value || '').trim().length > 0);
                                            
                                            return (
                                                <div key={ch.chapterId}>
                                                    <h3 
                                                        onClick={() => toggleChapter(ch.chapterId)}
                                                        className="font-serif text-lg text-ac-taupe/80 mb-4 pb-2 border-b border-ac-taupe/10 flex items-center justify-between cursor-pointer hover:text-ac-taupe transition-colors group"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            {ch.chapterTitle} 
                                                            <span className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold group-hover:text-ac-taupe/60 transition-colors">
                                                                ({ch.questions.length} Questions)
                                                            </span>
                                                            {allAnswered && (
                                                                <CheckCircle2 size={16} className="text-ac-olive" strokeWidth={2.5} />
                                                            )}
                                                        </span>
                                                        {isChapterOpen ? <ChevronDown size={16} className="text-ac-taupe/50 group-hover:text-ac-taupe transition-colors" /> : <ChevronRight size={16} className="text-ac-taupe/50 group-hover:text-ac-taupe transition-colors" />}
                                                    </h3>
                                                    <AnimatePresence>
                                                        {isChapterOpen && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.2 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="grid gap-4 pb-4">
                                                                    {ch.questions.map((q) => (
                                                                        <JournalQuestionRow 
                                                                            key={q.key} 
                                                                            question={q} 
                                                                            chapterId={ch.chapterId} 
                                                                            chapterSlug={ch.chapterSlug}
                                                                            masterclassId={mc.masterclassId}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}

            {filteredData.length > 0 && (
                <div className="text-center pt-8 text-ac-taupe/40 italic text-sm">
                    — End of Journal —
                </div>
            )}
        </div>
    );
}
