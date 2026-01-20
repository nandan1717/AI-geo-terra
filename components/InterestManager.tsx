import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Plus, X } from 'lucide-react';

interface InterestManagerProps {
    userId: string;
}

const InterestManager: React.FC<InterestManagerProps> = ({ userId }) => {
    const [topics, setTopics] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTopic, setNewTopic] = useState('');
    const [processingTopic, setProcessingTopic] = useState<string | null>(null);

    useEffect(() => {
        fetchInterests();
    }, [userId]);

    const fetchInterests = async () => {
        try {
            const { data, error } = await supabase
                .from('app_profiles_v2')
                .select('followed_topics')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setTopics(data?.followed_topics || []);
        } catch (error) {
            console.error('Error fetching interests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTopicDBOnly = async (topic: string) => {
        const updatedTopics = [...topics, topic];
        const { error } = await supabase
            .from('app_profiles_v2')
            .update({ followed_topics: updatedTopics })
            .eq('id', userId);
        if (error) throw error;
        setTopics(updatedTopics);
    };

    const handleRemoveTopicDBOnly = async (topic: string) => {
        const updatedTopics = topics.filter(t => t !== topic);
        const { error } = await supabase
            .from('app_profiles_v2')
            .update({ followed_topics: updatedTopics })
            .eq('id', userId);
        if (error) throw error;
        setTopics(updatedTopics);
    };

    const handleAddTopic = async () => {
        if (!newTopic.trim()) return;
        const topic = newTopic.trim().toLowerCase();
        if (topics.includes(topic)) return;

        setProcessingTopic('NEW');
        try {
            await handleAddTopicDBOnly(topic);
            setNewTopic('');
        } catch (error) {
            console.error('Error adding topic:', error);
            alert('Failed to save interest.');
        } finally {
            setProcessingTopic(null);
        }
    };

    const handleRemoveTopic = async (topicToRemove: string) => {
        setProcessingTopic(topicToRemove);
        try {
            await handleRemoveTopicDBOnly(topicToRemove);
        } catch (error) {
            console.error('Error removing topic:', error);
        } finally {
            setProcessingTopic(null);
        }
    };



    if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-400" /></div>;

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Your Interests</h3>



            {/* Existing Topics */}
            <div className="flex flex-wrap gap-2">
                {topics.map(topic => (
                    <div key={topic} className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full group">
                        <span className="text-xs font-medium text-blue-300 capitalize">{topic}</span>
                        <button
                            onClick={() => handleRemoveTopic(topic)}
                            disabled={processingTopic === topic}
                            className="p-1 hover:bg-blue-500/20 rounded-full text-blue-400 transition-colors"
                        >
                            {processingTopic === topic ? <Loader2 size={10} className="animate-spin" /> : <X size={12} />}
                        </button>
                    </div>
                ))}
            </div>

            {/* Add New Topic */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                    placeholder="Add topic (e.g. SpaceX)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <button
                    onClick={handleAddTopic}
                    disabled={!newTopic.trim() || processingTopic === 'NEW'}
                    className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-white/10 rounded-lg text-white transition-colors"
                >
                    {processingTopic === 'NEW' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                </button>
            </div>
            <p className="text-[10px] text-white/30 italic">
                Adding a topic subscribes you to Rich Notifications for that keyword.
            </p>
        </div>
    );
};

export default InterestManager;
