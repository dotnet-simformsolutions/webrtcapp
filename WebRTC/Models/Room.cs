namespace WebRTC.Models;

/// <summary>
/// Represents the room
/// </summary>
public class Room
{
	public required string RoomId { get; init; }
	public required string Name { get; init; }
	public required string HostConnectionId { get; init; }
}
