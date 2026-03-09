import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Pressable,
    AppState,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { io } from "socket.io-client";
import * as Notifications from "expo-notifications";
import SOCKET_URL from "../config";

export default function ChatRoomScreen({ route, navigation }) {
    const { displayName, roomCode } = route.params;
    const isFocused = useIsFocused();
    const isFocusedRef = useRef(isFocused);

    const socketRef = useRef(null);
    const flatListRef = useRef(null);
    const typingTimeout = useRef(null);

    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [polls, setPolls] = useState([]);
    const [inputText, setInputText] = useState("");
    const [membersVisible, setMembersVisible] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);

    // Reply state
    const [replyingTo, setReplyingTo] = useState(null);

    // Poll creation state
    const [pollModalVisible, setPollModalVisible] = useState(false);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);

    useEffect(() => {
        isFocusedRef.current = isFocused;
    }, [isFocused]);

    // ── Connect on mount ──
    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
            forceNew: true,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("join-room", { displayName, roomCode });
            if (Platform.OS === "web" && "serviceWorker" in navigator) {
                registerWebPush(socket);
            }
        });

        socket.on("room-members", (memberList) => setMembers(memberList));

        socket.on("chat-history", (history) => {
            setMessages(history);
            if (history.length < 50) setHasMoreMessages(false);
        });

        socket.on("new-message", (msg) => {
            setMessages((prev) => [...prev, msg]);
            if (
                Platform.OS !== "web" &&
                (!isFocusedRef.current || AppState.currentState !== "active")
            ) {
                Notifications.scheduleNotificationAsync({
                    content: { title: `🔒 ${roomCode}`, body: msg.text, sound: true },
                    trigger: null,
                });
            }
        });

        // Pagination
        socket.on("older-messages", (older) => {
            setLoadingOlder(false);
            if (older.length === 0) {
                setHasMoreMessages(false);
                return;
            }
            if (older.length < 25) setHasMoreMessages(false);
            setMessages((prev) => [...older, ...prev]);
        });

        // Polls
        socket.on("poll-history", (pollList) => setPolls(pollList));
        socket.on("new-poll", (poll) => setPolls((prev) => [...prev, poll]));
        socket.on("poll-update", (updatedPoll) => {
            setPolls((prev) => prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p)));
        });

        // Typing
        socket.on("user-typing", () => {
            setIsTyping(true);
            clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
        });

        socket.on("connect_error", (err) => console.warn("Socket err:", err.message));

        return () => {
            socket.disconnect();
            clearTimeout(typingTimeout.current);
        };
    }, [displayName, roomCode]);

    // ── Web Push ──
    const registerWebPush = async (socket) => {
        try {
            const registration = await navigator.serviceWorker.register("/service-worker.js");
            const res = await fetch(`${SOCKET_URL}/vapid-public-key`);
            const { publicKey } = await res.json();
            const urlBase64ToUint8Array = (b64) => {
                const pad = "=".repeat((4 - (b64.length % 4)) % 4);
                const raw = window.atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
                return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
            };
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
            socket.emit("register-push", sub.toJSON());
        } catch (err) {
            console.warn("Web Push registration failed:", err);
        }
    };

    // ── Typing debounce ──
    const typingDebounce = useRef(null);
    const handleTextChange = (text) => {
        setInputText(text);
        if (socketRef.current && text.trim()) {
            clearTimeout(typingDebounce.current);
            typingDebounce.current = setTimeout(() => socketRef.current.emit("typing"), 300);
        }
    };

    // ── Send message ──
    const sendMessage = useCallback(() => {
        const trimmed = inputText.trim();
        if (!trimmed || !socketRef.current) return;
        const payload = { text: trimmed };
        if (replyingTo) {
            payload.replyTo = { text: replyingTo.text, timestamp: replyingTo.timestamp };
        }
        socketRef.current.emit("send-message", payload);
        setInputText("");
        setReplyingTo(null);
    }, [inputText, replyingTo]);

    // ── Load older messages ──
    const loadOlderMessages = () => {
        if (loadingOlder || !hasMoreMessages || messages.length === 0 || !socketRef.current) return;
        setLoadingOlder(true);
        const oldestId = messages[0]?.id;
        if (oldestId) {
            socketRef.current.emit("load-more-messages", { beforeId: oldestId });
        } else {
            setLoadingOlder(false);
        }
    };

    // ── Poll helpers ──
    const addPollOption = () => {
        if (pollOptions.length < 10) setPollOptions([...pollOptions, ""]);
    };
    const removePollOption = (i) => {
        if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, idx) => idx !== i));
    };
    const submitPoll = () => {
        const q = pollQuestion.trim();
        const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (!q || opts.length < 2 || !socketRef.current) return;
        socketRef.current.emit("create-poll", { question: q, options: opts });
        setPollQuestion("");
        setPollOptions(["", ""]);
        setPollModalVisible(false);
    };
    const voteOnPoll = (pollId, optIdx) => {
        if (socketRef.current) socketRef.current.emit("vote-poll", { pollId, optionIndex: optIdx });
    };

    // ── Build combined feed ──
    const buildFeed = () => {
        const feed = [];
        messages.forEach((m) => feed.push({ type: "message", ...m }));
        polls.forEach((p) => feed.push({ type: "poll", ...p, timestamp: p.createdAt }));
        feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return feed;
    };

    const formatTime = (iso) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    // ── Render poll card ──
    const renderPollCard = (item) => (
        <View style={styles.pollCard}>
            <View style={styles.pollHeader}>
                <Text style={styles.pollLabel}>📊 POLL</Text>
                <Text style={styles.pollMeta}>{item.totalVotes} vote{item.totalVotes !== 1 ? "s" : ""}</Text>
            </View>
            <Text style={styles.pollQuestion}>{item.question}</Text>
            {item.options.map((opt, i) => {
                const pct = item.totalVotes > 0 ? Math.round((item.votes[i] / item.totalVotes) * 100) : 0;
                return (
                    <TouchableOpacity key={i} style={styles.pollOptionBtn} onPress={() => voteOnPoll(item.id, i)} activeOpacity={0.6}>
                        <View style={[styles.pollOptionFill, { width: `${pct}%` }]} />
                        <Text style={styles.pollOptionText}>{opt}</Text>
                        <Text style={styles.pollOptionPct}>{pct}%</Text>
                    </TouchableOpacity>
                );
            })}
            <Text style={styles.pollTime}>{formatTime(item.createdAt)}</Text>
        </View>
    );

    // ── Render feed item ──
    const renderFeedItem = ({ item }) => {
        if (item.type === "poll") return renderPollCard(item);
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => setReplyingTo(item)}
                delayLongPress={300}
            >
                <View style={styles.msgRow}>
                    {/* Reply quote */}
                    {item.replyTo && (
                        <View style={styles.replyQuote}>
                            <View style={styles.replyLine} />
                            <Text style={styles.replyQuoteText} numberOfLines={1}>
                                {item.replyTo.text}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.msgText}>{item.text}</Text>
                    <Text style={styles.msgTime}>{formatTime(item.timestamp)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const feedData = buildFeed();

    return (
        <SafeAreaView style={styles.safe}>
            {/* ── Snapchat-style Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.6} style={styles.headerBtn}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMembersVisible(true)} activeOpacity={0.6} style={styles.headerCenter}>
                    <View style={styles.headerAvatar}>
                        <Text style={{ fontSize: 16 }}>👻</Text>
                    </View>
                    <View>
                        <Text style={styles.headerName}>{roomCode}</Text>
                        <Text style={styles.headerSub}>{members.length} member{members.length !== 1 ? "s" : ""}</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPollModalVisible(true)} activeOpacity={0.6} style={styles.headerBtn}>
                    <Text style={{ fontSize: 20 }}>📊</Text>
                </TouchableOpacity>
            </View>

            {/* ── Members Modal ── */}
            <Modal visible={membersVisible} transparent animationType="fade" onRequestClose={() => setMembersVisible(false)}>
                <Pressable style={styles.overlay} onPress={() => setMembersVisible(false)}>
                    <View style={styles.membersCard}>
                        <View style={styles.membersHandle} />
                        <Text style={styles.membersTitle}>Members</Text>
                        {members.map((name, i) => (
                            <View key={i} style={styles.memberRow}>
                                <View style={styles.memberDot} />
                                <Text style={styles.memberName}>{name}</Text>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.membersDone} onPress={() => setMembersVisible(false)}>
                            <Text style={styles.membersDoneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* ── Poll Creation Modal ── */}
            <Modal visible={pollModalVisible} transparent animationType="slide" onRequestClose={() => setPollModalVisible(false)}>
                <Pressable style={styles.overlay} onPress={() => setPollModalVisible(false)}>
                    <Pressable style={styles.pollModal} onPress={() => { }}>
                        <View style={styles.membersHandle} />
                        <Text style={styles.membersTitle}>Create Poll</Text>
                        <TextInput style={styles.pollInput} placeholder="Ask a question..." placeholderTextColor="#666" value={pollQuestion} onChangeText={setPollQuestion} maxLength={200} />
                        {pollOptions.map((opt, i) => (
                            <View key={i} style={styles.pollOptRow}>
                                <TextInput
                                    style={[styles.pollInput, { flex: 1 }]}
                                    placeholder={`Option ${i + 1}`}
                                    placeholderTextColor="#666"
                                    value={opt}
                                    onChangeText={(t) => { const c = [...pollOptions]; c[i] = t; setPollOptions(c); }}
                                    maxLength={100}
                                />
                                {pollOptions.length > 2 && (
                                    <TouchableOpacity onPress={() => removePollOption(i)} style={styles.pollOptRemove}>
                                        <Text style={styles.pollOptRemoveText}>✕</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                        {pollOptions.length < 10 && (
                            <TouchableOpacity style={styles.pollAddBtn} onPress={addPollOption}>
                                <Text style={styles.pollAddText}>+ Add Option</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.pollSubmitBtn, (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) && { opacity: 0.4 }]}
                            onPress={submitPoll}
                            disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
                        >
                            <Text style={styles.pollSubmitText}>Create Poll</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── Message Feed ── */}
            <FlatList
                ref={flatListRef}
                data={feedData}
                keyExtractor={(item, i) => `${item.type}-${item.id || i}`}
                renderItem={renderFeedItem}
                contentContainerStyle={styles.feed}
                inverted
                scrollEventThrottle={100}
                onEndReached={loadOlderMessages}
                onEndReachedThreshold={0.1}
                ListFooterComponent={
                    loadingOlder ? (
                        <View style={styles.loadingMore}>
                            <ActivityIndicator color="#FFFC00" size="small" />
                        </View>
                    ) : hasMoreMessages && messages.length > 0 ? (
                        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadOlderMessages}>
                            <Text style={styles.loadMoreText}>Load more ↑</Text>
                        </TouchableOpacity>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={[styles.emptyContainer, { transform: [{ scaleY: -1 }] }]}>
                        <Text style={styles.emptyGhost}>👻</Text>
                        <Text style={styles.emptyText}>Say something anonymous!</Text>
                    </View>
                }
            />

            {/* ── Typing indicator ── */}
            {isTyping && (
                <View style={styles.typingBar}>
                    <Text style={styles.typingText}>typing...</Text>
                </View>
            )}

            {/* ── Reply bar ── */}
            {replyingTo && (
                <View style={styles.replyBar}>
                    <View style={styles.replyBarLine} />
                    <View style={styles.replyBarContent}>
                        <Text style={styles.replyBarLabel}>Reply</Text>
                        <Text style={styles.replyBarMsg} numberOfLines={1}>{replyingTo.text}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBarX}>
                        <Text style={styles.replyBarXText}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Input bar ── */}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
                <View style={styles.inputBar}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Send a chat"
                        placeholderTextColor="#666"
                        value={inputText}
                        onChangeText={handleTextChange}
                        multiline
                        maxLength={500}
                        onSubmitEditing={sendMessage}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !inputText.trim() && styles.sendBtnOff]}
                        onPress={sendMessage}
                        activeOpacity={0.7}
                        disabled={!inputText.trim()}
                    >
                        <Text style={styles.sendBtnText}>➤</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#000000" },

    // ── Header ──
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: "#222",
    },
    headerBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    backArrow: { color: "#FFFC00", fontSize: 36, fontWeight: "300", marginTop: -4 },
    headerCenter: { flex: 1, flexDirection: "row", alignItems: "center" },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#FFFC00",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    headerName: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
    headerSub: { color: "#888", fontSize: 12 },

    // ── Overlay / Modals ──
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
    membersCard: { backgroundColor: "#111", borderRadius: 12, padding: 20, width: "80%", maxHeight: "60%" },
    membersHandle: { width: 32, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginBottom: 16 },
    membersTitle: { color: "#FFF", fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: 16 },
    memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
    memberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFC00", marginRight: 12 },
    memberName: { color: "#FFF", fontSize: 15, fontWeight: "600" },
    membersDone: { marginTop: 16, backgroundColor: "#FFFC00", borderRadius: 20, paddingVertical: 10, alignItems: "center" },
    membersDoneText: { color: "#000", fontWeight: "800", fontSize: 14 },

    // ── Poll Modal ──
    pollModal: { backgroundColor: "#111", borderRadius: 12, padding: 20, width: "88%", maxHeight: "75%" },
    pollInput: { backgroundColor: "#1A1A1A", borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#FFF", marginBottom: 8 },
    pollOptRow: { flexDirection: "row", alignItems: "center" },
    pollOptRemove: { marginLeft: 8, marginBottom: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "#222", justifyContent: "center", alignItems: "center" },
    pollOptRemoveText: { color: "#FF3B30", fontSize: 13, fontWeight: "800" },
    pollAddBtn: { borderWidth: 1, borderColor: "#FFFC00", borderStyle: "dashed", borderRadius: 4, paddingVertical: 10, alignItems: "center", marginBottom: 8 },
    pollAddText: { color: "#FFFC00", fontSize: 14, fontWeight: "700" },
    pollSubmitBtn: { backgroundColor: "#FFFC00", borderRadius: 20, paddingVertical: 12, alignItems: "center", marginTop: 8 },
    pollSubmitText: { color: "#000", fontWeight: "800", fontSize: 15 },

    // ── Feed ──
    feed: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 1 },

    // ── Messages (FLAT like Snapchat) ──
    msgRow: {
        backgroundColor: "#111111",
        borderRadius: 2,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 2,
        alignSelf: "stretch",
    },
    msgText: { color: "#FFFFFF", fontSize: 15, lineHeight: 20 },
    msgTime: { color: "#555", fontSize: 10, marginTop: 4 },

    // ── Reply quote inside message ──
    replyQuote: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    replyLine: { width: 2, height: "100%", backgroundColor: "#FFFC00", marginRight: 8, borderRadius: 1, minHeight: 14 },
    replyQuoteText: { color: "#888", fontSize: 13, flex: 1 },

    // ── Reply bar above input ──
    replyBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#111", paddingHorizontal: 14, paddingVertical: 8 },
    replyBarLine: { width: 3, height: 28, backgroundColor: "#FFFC00", borderRadius: 1.5, marginRight: 10 },
    replyBarContent: { flex: 1 },
    replyBarLabel: { color: "#FFFC00", fontSize: 11, fontWeight: "800", marginBottom: 1 },
    replyBarMsg: { color: "#CCC", fontSize: 13 },
    replyBarX: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#222", justifyContent: "center", alignItems: "center", marginLeft: 8 },
    replyBarXText: { color: "#FF3B30", fontSize: 11, fontWeight: "800" },

    // ── Load more ──
    loadingMore: { paddingVertical: 16, alignItems: "center" },
    loadMoreBtn: { paddingVertical: 14, alignItems: "center" },
    loadMoreText: { color: "#FFFC00", fontSize: 13, fontWeight: "700" },

    // ── Empty ──
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
    emptyGhost: { fontSize: 48, marginBottom: 8 },
    emptyText: { color: "#666", fontSize: 14 },

    // ── Typing ──
    typingBar: { paddingHorizontal: 20, paddingVertical: 4 },
    typingText: { color: "#888", fontSize: 12, fontStyle: "italic" },

    // ── Input bar ──
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: "#000",
    },
    textInput: {
        flex: 1,
        backgroundColor: "#1A1A1A",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: "#FFF",
        maxHeight: 100,
    },
    sendBtn: {
        marginLeft: 8,
        backgroundColor: "#00CBFE",
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    sendBtnOff: { backgroundColor: "#222" },
    sendBtnText: { color: "#000", fontSize: 18, fontWeight: "700" },

    // ── Poll card in feed ──
    pollCard: {
        backgroundColor: "#111",
        borderRadius: 2,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 2,
        alignSelf: "stretch",
    },
    pollHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    pollLabel: { color: "#FFFC00", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    pollMeta: { color: "#666", fontSize: 11 },
    pollQuestion: { color: "#FFF", fontSize: 15, fontWeight: "700", marginBottom: 10 },
    pollOptionBtn: {
        position: "relative",
        backgroundColor: "#1A1A1A",
        borderRadius: 2,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 4,
        overflow: "hidden",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    pollOptionFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#FFFC0030", borderRadius: 2 },
    pollOptionText: { color: "#FFF", fontSize: 14, fontWeight: "600", zIndex: 1 },
    pollOptionPct: { color: "#AAA", fontSize: 12, fontWeight: "700", zIndex: 1 },
    pollTime: { color: "#555", fontSize: 10, marginTop: 6, textAlign: "right" },
});
