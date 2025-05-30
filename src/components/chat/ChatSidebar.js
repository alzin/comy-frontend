import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import './styles/ChatSidebar.scss';
import { SocketContext } from '../../pages/Chat';
import botImage from '../../assets/images/hedgehog.png';
import { API_URL } from '../../utils/apiUtils';

const ChatSidebar = ({ onSelectUser, selectedChatId, currentSystemUserId, setSelectedSenderId }) => {
  const socket = useContext(SocketContext);
  const [chats, setChats] = useState([]);
  const [now, setNow] = useState(new Date());
  const [botId, setBotId] = useState(null);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/chats`, { withCredentials: true });
        const allChats = res.data;
        console.log('Fetched chats:', allChats);

        // Get bot ID dynamically from the first bot chat
        const getBotId = () => {
          const botChat = allChats.find(chat => chat.name === "COMY オフィシャル AI");
          if (botChat && botChat.users) {
            const botUserId = botChat.users.find(id => id !== currentSystemUserId);
            return botUserId;
          }
          return null;
        };

        const dynamicBotId = getBotId();
        setBotId(dynamicBotId);

        const formatted = allChats.map(chat => ({
          id: chat.id,
          name: chat.name || 'Private Chat',
          users: chat.users,
          latestMessage: chat.latestMessage?.content || 'メッセージはありません ',
          latestTime: chat.latestMessage?.createdAt || chat.updatedAt,
          profileImageUrl: chat.profileImageUrl || '',
          unReadMessage: chat.id === selectedChatId ? false : !chat.latestMessage?.readBy.includes(currentSystemUserId)
        }));
        console.log('Fetched chats:', formatted);
        setChats(formatted);
      } catch (err) {
        console.error('Failed to load chats:', err);
      }
    };

    fetchChats();
  }, [currentSystemUserId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleMessageUpdate = (message) => {
      const { chatId, content, createdAt, readBy } = message;
      console.log('chatId', chatId);
      console.log('selectedChatId', selectedChatId);

      console.log('Received :', chatId === selectedChatId ? false : !readBy.includes(currentSystemUserId));
      setChats(prev =>
        prev.map(chat =>
          chat.id === chatId
            ? {
              ...chat,
              latestMessage: content,
              latestTime: createdAt,
              unReadMessage: chatId === selectedChatId ? false : !readBy.includes(currentSystemUserId)
            }
            : chat
        )
      );
    };

    // Listen for both received and sent messages
    socket.on('receive_message', handleMessageUpdate);
    socket.on('newMessage', handleMessageUpdate);

    // Clean up both listeners
    return () => {
      socket.off('receive_message', handleMessageUpdate);
      socket.off('newMessage', handleMessageUpdate);
    };
  }, [socket, selectedChatId, currentSystemUserId]);

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getOtherUserId = (chat) => {
    // Bot ID - you might need to adjust this based on your actual bot ID
    // const botId = "681547798892749fbe910c02"; // Update this with your actual bot ID

    // Filter out current user and bot to find the other user
    const otherUsers = chat.users.filter(userId =>
      userId !== currentSystemUserId && userId !== botId
    );

    return otherUsers.length > 0 ? otherUsers[0] : null;
  };

  const handleUserSelect = (userId, chat) => {
    const isBot = chat.name === "COMY オフィシャル AI";

    setChats(prev =>
      prev.map(c =>
        c.id === chat.id
          ? { ...c, unReadMessage: false }
          : c
      )
    );

    const chatInfo = {
      ...chat,
      profileImageUrl: isBot ? botImage : (chat.profileImageUrl || "/images/profileImage.png")
    };

    if (!isBot) {
      const otherUserId = getOtherUserId(chat);
      if (otherUserId) {
        setSelectedSenderId(otherUserId);
      }
    } else {
      setSelectedSenderId(null);
    }

    onSelectUser(userId, chatInfo);
  };

  useEffect(() => {
    if (socket) {
      for (const chat of chats) {
        socket.emit('joinChat', chat.id);
      }
    }
  }, [socket, chats]);

  return (
    <aside className="sidebarV2">
      {chats.map((chat, index) => {
        const isBot = chat.name === 'COMY オフィシャル AI';
        const isFirstBot = index === 0 && isBot;

        return (
          <div
            key={chat.id}
            className={`chatPreviewV2 ${selectedChatId === chat.id ? 'active' : ''}`}
            onClick={() => handleUserSelect(chat.id, chat)}
          >
            <div className="avatarContainerV2">
              {isFirstBot ? (
                <img src={botImage} alt="Bot" className="userAvatar" />
              ) : (
                <>
                  <img src={botImage} alt="Bot" className="botOverlay" />
                  {chat.profileImageUrl ? (
                    <img src={chat.profileImageUrl} alt="User" className="userAvatar" />
                  ) : (
                    <span className="userInitial">{chat.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  )}
                </>
              )}
            </div>

            <div className="messagePreviewV2">
              <div className="previewHeaderV2">
                <h3 className="userNameV2">{chat.name}</h3>
                <div className="timestampWrapper">
                  <span className="timestampV2">{formatTime(chat.latestTime)}</span>
                </div>
              </div>
              <p className="previewTextV2">{chat.latestMessage}</p>
            </div>
            {chat.unReadMessage && <div className="notificationDotV2" />}

          </div>
        );
      })}
    </aside>
  );
};

export default ChatSidebar;