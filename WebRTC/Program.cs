using Microsoft.AspNetCore.Http.Connections;
using WebRTC.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Controller with views
builder.Services.AddControllersWithViews();

// SignalR
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
	options.AddDefaultPolicy(builder =>
	{
		builder
			.AllowAnyOrigin()
			.AllowAnyHeader()
			.WithMethods("GET", "POST");
	});
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
	app.UseExceptionHandler("/Home/Error");
	app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.UseCors();

app.MapControllers();

app.MapHub<ConnectionHub>(
	"/connectionHub", 
	options => options.Transports = HttpTransportType.WebSockets);

app.Run();
