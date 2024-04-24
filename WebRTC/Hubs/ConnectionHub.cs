using Microsoft.AspNetCore.SignalR;
using System.Text.Json;
using WebRTC.Helpers;

namespace WebRTC.Hubs;

/// <summary>
/// SignalR connection hub with different methods
/// </summary>
public class ConnectionHub : Hub
{
	/// <summary>
	/// Instance of room manager helper to manage list of rooms for application life cycle
	/// </summary>
	private static readonly RoomManager _roomManager = new();

	/// <summary>
	/// Deletes the room on client disconnected from signalR hub
	/// </summary>
	/// <param name="exception"></param>
	/// <returns></returns>
	public override Task OnDisconnectedAsync(Exception? exception)
	{
		_roomManager.DeleteRoom(Context.ConnectionId);

		// Notifies the updated room list
		_ = NotifyRoomInfoAsync(false);

		return base.OnDisconnectedAsync(exception);
	}

	/// <summary>
	/// Notifies the updated room list info to the connected clients
	/// </summary>
	/// <param name="notifyOnlyCaller"></param>
	/// <returns></returns>
	public async Task NotifyRoomInfoAsync(bool notifyOnlyCaller)
	{
		var listOfRooms = _roomManager
			.GetAllRooms()
			.Select(x => new
			{
				x.RoomId,
				x.Name,
				Button = "<button class='btn btn-outline-secondary'>Join a room</button>"
			}).ToList();

		var jsonData = JsonSerializer.Serialize(listOfRooms);

		if (notifyOnlyCaller)
		{
			await Clients.Caller.SendAsync("updateRoom", jsonData);
		}
		else
		{
			await Clients.All.SendAsync("updateRoom", jsonData);
		}
	}

	/// <summary>
	/// Leave the room by id
	/// </summary>
	/// <param name="roomId"></param>
	/// <returns></returns>
	public async Task LeaveRoom(string roomId)
	{
		await Clients.Group(roomId).SendAsync("bye");
	}

	/// <summary>
	/// Get room list info
	/// </summary>
	/// <returns></returns>
	public async Task GetRoomInfo()
	{
		await NotifyRoomInfoAsync(true);
	}

	/// <summary>
	/// Sends the message
	/// </summary>
	/// <param name="roomId"></param>
	/// <param name="message"></param>
	/// <returns></returns>
	public async Task SendMessage(string roomId, object message)
	{
		await Clients.OthersInGroup(roomId).SendAsync("message", message);
	}

	/// <summary>
	/// Joins the room
	/// </summary>
	/// <param name="roomId"></param>
	/// <returns></returns>
	public async Task Join(string roomId)
	{
		// Add the client to group (room id)
		await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

		// Invoke joined method of the caller
		await Clients.Caller.SendAsync("joined", roomId);

		// Invoke ready method of all clients for this room id (whoever is connected in the room)
		await Clients.Group(roomId).SendAsync("ready");

		// Remove the room from room list so no other client can join.
		if (int.TryParse(roomId, out var id))
		{
			_roomManager.DeleteRoom(id);
			await NotifyRoomInfoAsync(false);
		}
	}

	/// <summary>
	/// Creates the room
	/// </summary>
	/// <param name="name"></param>
	/// <returns></returns>
	public async Task CreateRoom(string name)
	{
		var room = _roomManager.CreateRoom(Context.ConnectionId, name);
		if (room is not null)
		{
			// Add the client to group (room id)
			await Groups.AddToGroupAsync(Context.ConnectionId, room.RoomId);

			// Invoke created method of the caller
			await Clients.Caller.SendAsync("created", room.RoomId);

			// Notify the updated room info list
			await NotifyRoomInfoAsync(false);
		}
		else
		{
			await Clients.Caller.SendAsync("error", "error occurred when creating a new room.");
		}
	}
}