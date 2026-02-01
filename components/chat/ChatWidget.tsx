'use client';

/**
 * Floating Chat Widget Component
 *
 * WHY Client Component:
 * - Uses React hooks (useState, useRef, useEffect)
 * - Handles user interactions and events
 * - Manages local UI state
 *
 * WHY Floating: Provides consistent access across all pages
 * without interfering with page content.
 */

import React, { useState, useRef, useEffect, useTransition } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendChatMessage, ChatResponse } from '@/lib/actions/chat.actions';

// Message type for chat history
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const ChatWidget = () => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();

  // Refs for auto-scroll and input focus
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Generate unique message ID
  const generateId = () =>
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Handle sending a message
  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isPending) return;

    // Add user message to chat
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: trimmedInput,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Send to AI using transition for better UX
    startTransition(async () => {
      const response: ChatResponse = await sendChatMessage(trimmedInput);

      // Add AI response to chat
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.success
          ? response.message
          : response.error || "Sorry, I couldn't process that request.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    });
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Toggle chat open/close
  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      {/* Chat Window - Opens upward from the button */}
      {isOpen && (
        <div
          className='fixed bottom-[68px] right-2 sm:right-4 left-2 sm:left-auto z-50 sm:w-96 h-[60vh] sm:h-[450px] max-h-[500px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden'
        >
          {/* Header */}
          <div className='flex items-center justify-between p-3 bg-primary text-primary-foreground rounded-t-xl'>
            <div className='flex items-center gap-2'>
              <MessageCircle className='h-5 w-5' />
              <span className='font-semibold text-sm'>
                VibeShopping Assistant
              </span>
            </div>
            <Button
              variant='ghost'
              size='icon'
              className='h-8 w-8 hover:bg-primary-foreground/20 text-primary-foreground'
              onClick={toggleChat}
              aria-label='Close chat'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>

          {/* Messages Area */}
          <div className='flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30'>
            {/* Welcome message if no messages */}
            {messages.length === 0 && (
              <div className='text-center text-muted-foreground text-sm py-8'>
                <MessageCircle className='h-10 w-10 mx-auto mb-3 opacity-50' />
                <p className='font-medium'>Welcome to VibeShopping!</p>
                <p className='mt-1'>How can I help you today?</p>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border border-border'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isPending && (
              <div className='flex justify-start'>
                <div className='bg-background border border-border rounded-lg px-3 py-2'>
                  <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className='p-3 border-t border-border bg-background safe-area-inset-bottom'>
            <div className='flex gap-2'>
              <input
                ref={inputRef}
                type='text'
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder='Ask me anything...'
                disabled={isPending}
                className='flex-1 px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50'
                maxLength={500}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isPending}
                size='icon'
                className='shrink-0 h-10 w-10'
                aria-label='Send message'
              >
                {isPending ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Send className='h-4 w-4' />
                )}
              </Button>
            </div>
            <p className='text-[10px] sm:text-xs text-muted-foreground mt-1.5 text-center'>
              Powered by AI • {500 - input.length} characters left
            </p>
          </div>
        </div>
      )}

      {/* Floating Chat Button - Fixed at bottom right, below cart button */}
      <Button
        onClick={toggleChat}
        className='fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105'
        size='icon'
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <X className='h-5 w-5' />
        ) : (
          <MessageCircle className='h-5 w-5' />
        )}
      </Button>
    </>
  );
};

export default ChatWidget;
