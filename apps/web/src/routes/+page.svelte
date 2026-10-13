<script lang="ts">
  import JoinForm from "$lib/home/JoinForm.svelte";
  import RoomList from "$lib/home/RoomList.svelte";
  import Shelf from "$lib/home/Shelf.svelte";
  import NewRoomTile from "$lib/home/NewRoomTile.svelte";
</script>

<div class="page">
  <Shelf />
  <NewRoomTile />
  <RoomList />
  <JoinForm />
</div>
