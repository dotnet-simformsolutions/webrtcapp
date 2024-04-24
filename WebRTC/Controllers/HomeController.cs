using Microsoft.AspNetCore.Mvc;

namespace WebRTC.Controllers;

[Route("")]
[Route("Home")]
public class HomeController : Controller
{
	[HttpGet("")]
	[HttpGet("Index")]
	public IActionResult Index()
	{
		return View();
	}
}
