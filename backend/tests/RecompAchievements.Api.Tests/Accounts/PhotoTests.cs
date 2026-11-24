using System.Buffers.Binary;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.Moderation;
using SkiaSharp;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Accounts;

public sealed class PhotoTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Photo = "/api/v1/auth/photo";

    private async Task<(string Username, string Session)> NewPlayer(bool established = true, string role = "player")
    {
        using var client = factory.CreateWebsiteClient();
        var (username, email) = (NewUsername(), NewEmail());
        var session = await CreateConfirmedAccount(factory, client, email, username);
        await WithDb(factory, db => db.Users.Where(u => u.Email == email).ExecuteUpdateAsync(s => s
            .SetProperty(u => u.Role, role)
            .SetProperty(u => u.CreatedAt, u => established ? u.CreatedAt.AddDays(-30) : u.CreatedAt), Ct));
        return (username, session);
    }

    private static async Task<HttpResponseMessage> Upload(HttpClient client, string? session, byte[] image, bool rights = true)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{Photo}?rightsConfirmed={(rights ? "true" : "false")}") { Content = new ByteArrayContent(image) };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        if (session is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session);
        }

        return await client.SendAsync(request, Ct);
    }

    private static byte[] Image(SKEncodedImageFormat format = SKEncodedImageFormat.Png, int width = 640, int height = 480, SKColor? color = null)
    {
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(color ?? SKColors.Orange);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 95);
        return data.ToArray();
    }

    // A JPEG with quadrants red, green / blue, white and an EXIF orientation tag.
    private static byte[] OrientedJpeg(ushort orientation)
    {
        using var bitmap = new SKBitmap(128, 128);
        using (var canvas = new SKCanvas(bitmap))
        {
            using var paint = new SKPaint();
            foreach (var (x, y, color) in new[] { (0, 0, SKColors.Red), (64, 0, SKColors.Lime), (0, 64, SKColors.Blue), (64, 64, SKColors.White) })
            {
                paint.Color = color;
                canvas.DrawRect(x, y, 64, 64, paint);
            }
        }

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 100);
        return InsertApp1(data.ToArray(), ExifWithOrientation(orientation));
    }

    private static byte[] ExifWithOrientation(ushort orientation)
    {
        var exif = new byte[6 + 8 + 2 + 12 + 4];
        Encoding.ASCII.GetBytes("Exif").CopyTo(exif, 0);
        var tiff = exif.AsSpan(6);
        tiff[0] = (byte)'I';
        tiff[1] = (byte)'I';
        BinaryPrimitives.WriteUInt16LittleEndian(tiff[2..], 42);
        BinaryPrimitives.WriteUInt32LittleEndian(tiff[4..], 8);
        BinaryPrimitives.WriteUInt16LittleEndian(tiff[8..], 1);
        BinaryPrimitives.WriteUInt16LittleEndian(tiff[10..], 0x0112);
        BinaryPrimitives.WriteUInt16LittleEndian(tiff[12..], 3);
        BinaryPrimitives.WriteUInt32LittleEndian(tiff[14..], 1);
        BinaryPrimitives.WriteUInt16LittleEndian(tiff[18..], orientation);
        return exif;
    }

    private static byte[] InsertApp1(byte[] jpeg, byte[] payload)
    {
        var length = (ushort)(payload.Length + 2);
        return [.. jpeg[..2], 0xFF, 0xE1, (byte)(length >> 8), (byte)length, .. payload, .. jpeg[2..]];
    }

    // Wraps two lossless frames in the animated WebP container.
    private static byte[] AnimatedWebp()
    {
        byte[] Frame(SKColor color)
        {
            using var bitmap = new SKBitmap(16, 16);
            bitmap.Erase(color);
            using var pixels = bitmap.PeekPixels();
            using var encoded = pixels.Encode(new SKWebpEncoderOptions(SKWebpEncoderCompression.Lossless, 100));
            return encoded!.ToArray()[12..];
        }

        static byte[] Chunk(string name, byte[] body)
        {
            var padded = body.Length % 2 == 1;
            var chunk = new byte[8 + body.Length + (padded ? 1 : 0)];
            Encoding.ASCII.GetBytes(name).CopyTo(chunk, 0);
            BinaryPrimitives.WriteUInt32LittleEndian(chunk.AsSpan(4), (uint)body.Length);
            body.CopyTo(chunk, 8);
            return chunk;
        }

        static byte[] Anmf(byte[] frame)
        {
            byte[] header = [0, 0, 0, 0, 0, 0, 15, 0, 0, 15, 0, 0, 100, 0, 0, 0];
            return Chunk("ANMF", [.. header, .. frame]);
        }

        byte[] vp8x = [0x02, 0, 0, 0, 15, 0, 0, 15, 0, 0];
        byte[] anim = [0, 0, 0, 0, 0, 0];
        byte[] body = [.. Encoding.ASCII.GetBytes("WEBP"), .. Chunk("VP8X", vp8x), .. Chunk("ANIM", anim), .. Anmf(Frame(SKColors.Red)), .. Anmf(Frame(SKColors.Blue))];
        var riff = new byte[8 + body.Length];
        Encoding.ASCII.GetBytes("RIFF").CopyTo(riff, 0);
        BinaryPrimitives.WriteUInt32LittleEndian(riff.AsSpan(4), (uint)body.Length);
        body.CopyTo(riff, 8);
        return riff;
    }

    private static string? AvatarKey(JsonElement avatar) =>
        avatar.GetProperty("large").GetString()!.Replace("https://media.test/", string.Empty, StringComparison.Ordinal);

    [Theory]
    [InlineData(SKEncodedImageFormat.Png)]
    [InlineData(SKEncodedImageFormat.Jpeg)]
    [InlineData(SKEncodedImageFormat.Webp)]
    public async Task A_valid_image_becomes_two_square_webp_files(SKEncodedImageFormat format)
    {
        var (username, session) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Upload(client, session, Image(format));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        var large = factory.Media.Files[AvatarKey(json)!];
        using var codec = SKCodec.Create(new MemoryStream(large));
        Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat);
        Assert.Equal(512, codec.Info.Width);
        Assert.Equal(512, codec.Info.Height);
        var player = await client.GetFromJsonAsync<JsonElement>($"/api/v1/users/{username}", Ct);
        Assert.EndsWith("-96.webp", player.GetProperty("avatar").GetProperty("small").GetString(), StringComparison.Ordinal);
    }

    public static TheoryData<string, byte[]> UnsafeFiles()
    {
        var data = new TheoryData<string, byte[]>();
        data.Add("svg", Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"));
        data.Add("text with an image name", Encoding.UTF8.GetBytes("this is not a picture"));
        data.Add("truncated header", [0xFF, 0xD8, 0xFF]);
        data.Add("gif", [.. "GIF89a"u8, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255, 0x2C, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3B]);
        data.Add("animated webp", AnimatedWebp());
        data.Add("too large", new byte[AvatarImages.MaxUploadBytes + 1]);
        return data;
    }

    [Theory]
    [MemberData(nameof(UnsafeFiles))]
    public async Task Unsafe_files_are_refused(string name, byte[] file)
    {
        var (_, session) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Upload(client, session, file);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, name);
        Assert.Equal("photo_invalid", await ProblemCode(response));
    }

    [Fact]
    public void Oversized_dimensions_are_refused()
    {
        var png = Image(width: 7000, height: 10);
        Assert.Null(AvatarImages.Process(png));
    }

    [Fact]
    public async Task Metadata_is_removed()
    {
        var (_, session) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        var secret = Encoding.ASCII.GetBytes("Exif\0\0SECRET-GPS-LOCATION");
        var marked = InsertApp1(Image(SKEncodedImageFormat.Jpeg), secret);

        using var response = await Upload(client, session, marked);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        var stored = Encoding.ASCII.GetString(factory.Media.Files[AvatarKey(json)!]);
        Assert.DoesNotContain("SECRET-GPS", stored, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(1, "RGBW")]
    [InlineData(2, "GRWB")]
    [InlineData(3, "WBGR")]
    [InlineData(4, "BWRG")]
    [InlineData(5, "RBGW")]
    [InlineData(6, "BRWG")]
    [InlineData(7, "WGBR")]
    [InlineData(8, "GWRB")]
    public void Camera_orientation_is_applied(ushort orientation, string expected)
    {
        var avatar = AvatarImages.Process(OrientedJpeg(orientation));

        Assert.NotNull(avatar);
        using var bitmap = SKBitmap.Decode(avatar.Large);
        static char Name(SKColor c) => (c.Red > 200, c.Green > 200, c.Blue > 200) switch
        {
            (true, true, true) => 'W',
            (true, _, _) => 'R',
            (_, true, _) => 'G',
            _ => 'B',
        };
        var actual = string.Concat(Name(bitmap.GetPixel(128, 128)), Name(bitmap.GetPixel(384, 128)), Name(bitmap.GetPixel(128, 384)), Name(bitmap.GetPixel(384, 384)));
        Assert.Equal(expected, actual);
    }

    [Fact]
    public async Task Uploads_need_a_session_rights_an_established_account_and_no_mute()
    {
        var (_, session) = await NewPlayer();
        var (_, newcomer) = await NewPlayer(established: false);
        var (mutedName, muted) = await NewPlayer();
        await WithDb(factory, db => db.Users.Where(u => u.Username == mutedName)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.MutedUntil, DateTimeOffset.UtcNow.AddDays(1)), Ct));
        using var client = factory.CreateWebsiteClient();
        var image = Image();

        using var signedOut = await Upload(client, null, image);
        using var noRights = await Upload(client, session, image, rights: false);
        using var tooNew = await Upload(client, newcomer, image);
        using var mutedUpload = await Upload(client, muted, image);

        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);
        Assert.Equal("photo_rights_required", await ProblemCode(noRights));
        Assert.Equal("photo_not_allowed_yet", await ProblemCode(tooNew));
        Assert.Equal("account_muted", await ProblemCode(mutedUpload));
    }

    [Fact]
    public async Task Replacing_and_deleting_clean_up_old_files()
    {
        var (username, session) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        using var first = await Upload(client, session, Image(color: SKColors.Red));
        var firstKey = AvatarKey(await first.Content.ReadFromJsonAsync<JsonElement>(Ct))!;

        using var second = await Upload(client, session, Image(color: SKColors.Blue));
        var secondKey = AvatarKey(await second.Content.ReadFromJsonAsync<JsonElement>(Ct))!;

        Assert.False(factory.Media.Files.ContainsKey(firstKey));
        Assert.Contains(firstKey, factory.Media.Purged);
        Assert.True(factory.Media.Files.ContainsKey(secondKey));

        using var deleted = await Send(client, HttpMethod.Delete, Photo, session);
        var player = await client.GetFromJsonAsync<JsonElement>($"/api/v1/users/{username}", Ct);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.False(factory.Media.Files.ContainsKey(secondKey));
        Assert.Equal(JsonValueKind.Null, player.GetProperty("avatar").ValueKind);
    }

    [Fact]
    public async Task Moderator_removal_deletes_and_purges_the_photo()
    {
        var (username, session) = await NewPlayer();
        var (_, moderator) = await NewPlayer(role: UserRoles.Moderator);
        using var client = factory.CreateWebsiteClient();
        using var uploaded = await Upload(client, session, Image(color: SKColors.Purple));
        var key = AvatarKey(await uploaded.Content.ReadFromJsonAsync<JsonElement>(Ct))!;

        using var removed = await Send(client, HttpMethod.Post, $"/api/v1/moderation/users/{username}/photo/remove", moderator, new { reason = "Nudity" });

        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);
        Assert.True((await removed.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("cachePurged").GetBoolean());
        Assert.False(factory.Media.Files.ContainsKey(key));
        Assert.Contains(key, factory.Media.Purged);
        Assert.Null((await FindUser(factory, users => users.Where(u => u.Username == username)))!.AvatarKey);
    }

    [Fact]
    public async Task Legal_hold_is_admin_only_preserves_evidence_and_disables_the_account()
    {
        var (username, session) = await NewPlayer();
        var (_, moderator) = await NewPlayer(role: UserRoles.Moderator);
        var (_, admin) = await NewPlayer(role: UserRoles.Admin);
        using var client = factory.CreateWebsiteClient();
        using var uploaded = await Upload(client, session, Image(color: SKColors.Teal));
        var key = AvatarKey(await uploaded.Content.ReadFromJsonAsync<JsonElement>(Ct))!;
        var path = $"/api/v1/moderation/users/{username}/photo/legal-hold";

        using var byModerator = await Send(client, HttpMethod.Post, path, moderator, new { reason = "Illegal" });
        using var byAdmin = await Send(client, HttpMethod.Post, path, admin, new { reason = "Illegal" });
        using var log = await Send(client, HttpMethod.Get, "/api/v1/moderation/log", admin);

        Assert.Equal(HttpStatusCode.Forbidden, byModerator.StatusCode);
        Assert.Equal(HttpStatusCode.OK, byAdmin.StatusCode);
        Assert.False(factory.Media.Files.ContainsKey(key));
        Assert.NotEmpty(factory.Media.Preserved);
        Assert.False((await FindUser(factory, users => users.Where(u => u.Username == username)))!.IsEnabled);
        Assert.DoesNotContain("evidence/", await log.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
    }
}
