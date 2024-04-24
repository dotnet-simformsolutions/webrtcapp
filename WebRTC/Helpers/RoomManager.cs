using System.Collections.Concurrent;
using WebRTC.Models;

namespace WebRTC.Helpers;

/// <summary>
/// RoomManager Helper class for managing list of rooms for application life cycle
/// </summary>
public class RoomManager
{
	private readonly ConcurrentDictionary<int, Room> _rooms = new();
	private int _nextRoomId = 1;

	/// <summary>
	/// Creates the new room
	/// </summary>
	/// <param name="connectionId"></param>
	/// <param name="name"></param>
	/// <returns>The object of type <see cref="Room"/> if created successfully, otherwise null value</returns>
	public Room? CreateRoom(
		string connectionId,
		string name)
	{
		// Remove any existing room with the same ID
		_rooms.TryRemove(_nextRoomId, out _);

		var room = new Room
		{
			RoomId = _nextRoomId.ToString(),
			Name = name,
			HostConnectionId = connectionId
		};

		// If failed to add a room
		if (!_rooms.TryAdd(_nextRoomId, room))
			return null;

		// Increment the next room id
		_nextRoomId++;
		return room;
	}

	/// <summary>
	/// Deletes the room by room id
	/// </summary>
	/// <param name="roomId"></param>
	public void DeleteRoom(int roomId)
	{
		_rooms.TryRemove(roomId, out _);
	}

	/// <summary>
	/// Deletes the room by connection id
	/// </summary>
	/// <param name="connectionId"></param>
	public void DeleteRoom(string connectionId)
	{
		int? correspondingRoomId = _rooms.FirstOrDefault(pair => pair.Value.HostConnectionId.Equals(connectionId)).Key;

		if (correspondingRoomId.HasValue)
		{
			_rooms.TryRemove(correspondingRoomId.Value, out _);
		}
	}

	/// <summary>
	/// Retrieves the list of rooms
	/// </summary>
	/// <returns>The list of type <see cref="Room"/></returns>
	public IEnumerable<Room> GetAllRooms()
	{
		return _rooms.Values.ToList();
	}
}
