import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const submitLock = { locked: false };

export default function AskCortensorAI({ isMenuActive }) {
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTime, setAiTime] = useState(null);
  const [minerProof, setMinerProof] = useState(null);
  const [validMiner, setValidMiner] = useState(null);
  const [expandedMiner, setExpandedMiner] = useState(null);
  const [thinkingDots, setThinkingDots] = useState(".");
  const [showResponseBox, setShowResponseBox] = useState(false);

  const [selectedModel, setSelectedModel] = useState("LLaVA 1.5 7B Q4");

  const modelOptions = [
    "LLaVA 1.5 7B Q4",
    "Qwen2.5 Coder 14B Instruct Q4",
    "DeepSeek R1 Distill Llama 8B Q4",
    "LLaMA 3.1 8B Q4",
    "Mistral 7B Q4",
    "Granite 3.2 8B Q4",
    "Qwen2.5 7B Q4",
    "Google Gemma 3 4B Q4"
  ];

  const responseBoxRef = useRef(null);

  useEffect(() => {
    let interval;
    if (aiLoading) {
      interval = setInterval(() => {
        setThinkingDots((prev) => (prev === "..." ? "." : prev + "."));
      }, 500);
    } else {
      setThinkingDots(".");
    }
    return () => clearInterval(interval);
  }, [aiLoading]);

  // 🔹 Auto scroll ke bawah setiap kali ada response baru
  useEffect(() => {
    if (responseBoxRef.current) {
      responseBoxRef.current.scrollTop = responseBoxRef.current.scrollHeight;
    }
  }, [aiResponse]);

  const handleAskAI = async () => {
    if (aiLoading || submitLock.locked) return;
    submitLock.locked = true;

    setAiLoading(true);
    setAiTime(null);
    setAiResponse("");
    setMinerProof(null);
    setValidMiner(null);
    setShowResponseBox(true);
    const start = Date.now();

    try {
      fetch(process.env.NEXT_PUBLIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`,
        },
        body: JSON.stringify({
          session_id: process.env.NEXT_PUBLIC_SESSION_ID,
          prompt: aiPrompt,
          stream: false,
          timeout: 60,
        }),
      }).catch((err) => console.error("Trigger error", err));

      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const taskRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_TASK}/${process.env.NEXT_PUBLIC_SESSION_ID}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` },
            }
          );

          const taskData = await taskRes.json();
          if (taskData && taskData.tasks?.length > 0) {
            const lastTask = taskData.tasks[taskData.tasks.length - 1];
            const miners = lastTask.assigned_miners.map((m, idx) => ({
              minerId: m,
              result: lastTask.results[idx] || "",
              hash: lastTask.results_hash[idx] || "",
            }));
            setMinerProof({ miners });

            const valid = miners.find((miner) => miner.result?.trim()) || miners[0];
            if (valid && valid.result) {
           
              const cleanedResult = valid.result.replace(/<\/s>/g, "").trim();
              setValidMiner(valid);
              setAiResponse(cleanedResult);
              setAiTime(((Date.now() - start) / 1000).toFixed(2));
              clearInterval(pollInterval);
              setAiLoading(false);
              submitLock.locked = false;
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setAiResponse("⚠️ Timeout waiting for miner response.");
          setAiLoading(false);
          submitLock.locked = false;
        }
      }, 2000);
    } catch (err) {
      console.error("[Error]", err);
      setAiResponse("⚠️ Error connecting to Cortensor node.");
      setAiLoading(false);
      submitLock.locked = false;
    }
  };

  const toggleMiner = (minerId) => {
    setExpandedMiner(expandedMiner === minerId ? null : minerId);
  };

  return (
    <>
      {!isMenuActive && (
        <button
          onClick={() => setShowAI(true)}
          className="fixed bottom-6 right-6 bg-white text-black shadow-lg px-4 py-2 rounded-full font-semibold hover:scale-105 transition"
        >
          Ask Cortensor AI
        </button>
      )}

      <AnimatePresence>
        {showAI && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 md:inset-auto md:bottom-20 md:right-6 
                       flex flex-col md:flex-row gap-4 z-50 
                       items-center justify-center md:justify-end p-4"
          >
            {/* Miner Proof */}
            {aiTime && minerProof && (
              <div className="w-full md:w-80 max-h-[30vh] md:max-h-[60vh] overflow-y-auto 
                              border rounded-2xl p-4 bg-white text-xs text-gray-700 shadow flex flex-col">
                <strong>🔒 Secure By Cortensor</strong>
                <div className="space-y-2 mt-2">
                  {minerProof.miners.map((miner) => (
                    <div
                      key={miner.minerId}
                      className="border rounded-lg p-2 bg-gray-200 shadow cursor-pointer"
                      onClick={() => toggleMiner(miner.minerId)}
                    >
                      <div className="font-mono text-xs text-black break-all">
                        {miner.minerId}
                      </div>
                      {expandedMiner === miner.minerId && (
                        <div className="mt-2 text-xs whitespace-pre-wrap break-words bg-white p-2 rounded">
                          <div>
                            <strong>Hash:</strong> {miner.hash}
                          </div>
                          <div className="mt-1">
                            <strong>Output:</strong> {miner.result}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {validMiner && (
                  <div className="mt-4">
                    <strong>✅ Valid Answer By Cortensor</strong>
                    <div
                      className="border rounded-lg p-2 bg-gray-200 shadow mt-2 cursor-pointer"
                      onClick={() => toggleMiner(validMiner.minerId)}
                    >
                      <div className="font-mono text-xs text-black break-all">
                        {validMiner.minerId}
                      </div>
                      {expandedMiner === validMiner.minerId && (
                        <div className="mt-2 text-xs whitespace-pre-wrap break-words bg-white p-2 rounded">
                          <div>
                            <strong>Hash:</strong> {validMiner.hash}
                          </div>
                          <div className="mt-1">
                            <strong>Output:</strong> {validMiner.result}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Box utama */}
            <div className="w-full md:w-96 flex flex-col items-stretch gap-4">
              {/* MOBILE */}
              <div className="block md:hidden bg-white rounded-2xl shadow-xl p-4 max-h-[70vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-3">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={aiLoading}
                    className="border rounded px-2 py-1 text-sm disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m} disabled={m !== "LLaVA 1.5 7B Q4"}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowAI(false)}
                    className="text-gray-400 hover:text-gray-600 text-lg font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>

                {showResponseBox && (
                  <div className="relative border rounded-xl p-3 bg-gray-50 text-sm whitespace-pre-line shadow mb-3">
                    {aiTime && (
                      <div className="text-xs text-gray-400 text-right mb-1">
                        Response time: {aiTime}s
                      </div>
                    )}
                    {aiLoading ? (
                      <span>{`Cortensor Thinking, Wait ${thinkingDots}`}</span>
                    ) : (
                      <span>{aiResponse}</span>
                    )}
                  </div>
                )}

                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Type your question here..."
                  disabled={aiLoading}
                  className="w-full border rounded-lg p-2 text-sm mb-3 disabled:bg-gray-100 disabled:text-gray-500"
                  rows={2}
                />
                <button
                  onClick={handleAskAI}
                  disabled={aiLoading}
                  className={`bg-white text-black border shadow px-4 py-2 rounded-lg font-semibold transition ${
                    aiLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                  }`}
                >
                  Ask
                </button>
              </div>

              {/* DESKTOP */}
              <div className="hidden md:flex flex-col">
                {showResponseBox && (
                  <div
                    ref={responseBoxRef}
                    className="relative border rounded-2xl p-4 bg-white text-sm whitespace-pre-line shadow mb-3 
                               max-h-[50vh] overflow-y-auto"
                  >
                    {aiTime && (
                      <div className="text-xs text-gray-400 text-right mb-1">
                        Response time: {aiTime}s
                      </div>
                    )}
                    {aiLoading ? (
                      <span>{`Cortensor Thinking, Wait ${thinkingDots}`}</span>
                    ) : (
                      <span>{aiResponse}</span>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={aiLoading}
                      className="border rounded px-2 py-1 text-sm disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      {modelOptions.map((m) => (
                        <option key={m} value={m} disabled={m !== "LLaVA 1.5 7B Q4"}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowAI(false)}
                      className="text-gray-400 hover:text-gray-600 text-lg font-bold ml-2"
                    >
                      ✕
                    </button>
                  </div>

                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Type your question here..."
                    disabled={aiLoading}
                    className="w-full border rounded-lg p-2 text-sm mb-3 disabled:bg-gray-100 disabled:text-gray-500"
                    rows={2}
                  />
                  <button
                    onClick={handleAskAI}
                    disabled={aiLoading}
                    className={`bg-white text-black border shadow px-4 py-2 rounded-lg font-semibold transition ${
                      aiLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                    }`}
                  >
                    Ask
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
